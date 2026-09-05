import os
import json
import csv
import io
import re
import hmac
import hashlib
import math
import base64
import secrets
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import razorpay
from openai import OpenAI
from sqlalchemy import Column, DateTime, Integer, String, Float, create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aegis.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    max_discount = Column(Integer, nullable=True)


class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id = Column(Integer, primary_key=True, index=True)
    max_discount_allowed = Column(Integer, nullable=False, default=15)


class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_taken = Column(String, nullable=False)
    ai_reasoning = Column(String, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)


class PaymentLink(Base):
    __tablename__ = "payment_links"

    id = Column(Integer, primary_key=True, index=True)
    razorpay_link_id = Column(String, nullable=False, unique=True, index=True)
    short_url = Column(String, nullable=False)
    product_id = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="created")
    paid_at = Column(DateTime, nullable=True)
    invoice_number = Column(String, nullable=True, unique=True)
    buyer_username = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # SQLite does not add model columns to an existing table automatically.
    with engine.begin() as connection:
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(products)"))}
        if "max_discount" not in columns:
            connection.execute(text("ALTER TABLE products ADD COLUMN max_discount INTEGER"))
        payment_link_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(payment_links)"))}
        if payment_link_columns and "buyer_username" not in payment_link_columns:
            connection.execute(text("ALTER TABLE payment_links ADD COLUMN buyer_username TEXT"))
    seed_data()
    yield


app = FastAPI(title="ChatShop - Razorpay Integration", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_dummy_key")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret_key")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
SESSION_SECRET = os.getenv("APP_SESSION_SECRET") or secrets.token_urlsafe(48)

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Loaded from backend/.env; never expose this credential to the browser.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1") if GROQ_API_KEY else None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 310_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def _verify_password(password: str, stored: str) -> bool:
    if not stored.startswith("pbkdf2_sha256$"):
        return hmac.compare_digest(password, stored)  # Existing local accounts are upgraded on login.
    _, salt, digest = stored.split("$", 2)
    return hmac.compare_digest(_password_hash(password, salt), stored)


def _create_session(user: User) -> str:
    payload = json.dumps({"id": user.id, "role": user.role, "exp": int((datetime.now(timezone.utc) + timedelta(hours=8)).timestamp())}, separators=(",", ":")).encode()
    encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(SESSION_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(SESSION_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if payload["exp"] < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError
        user = db.query(User).filter(User.id == payload["id"], User.role == payload["role"]).first()
        if user is None:
            raise ValueError
        return user
    except (ValueError, KeyError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Please sign in again")


def require_buyer(user: User = Depends(get_current_user)) -> User:
    if user.role != "buyer":
        raise HTTPException(status_code=403, detail="Buyer access required")
    return user


def _safe_ai_reply(reply: str | None) -> str:
    """Never allow a generative model to represent payment or an invoice as verified."""
    if re.search(r"payment (has been )?verified|official invoice|fulfillment initiated|total paid", reply or "", re.IGNORECASE):
        return "For security, payment status and invoices are confirmed only by Razorpay. Complete payment, then ask for your invoice."
    return reply or "I could not prepare a response."


def seed_data():
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            products = [
                Product(name="Wireless Earbuds", price=2500, stock=350),
                Product(name="Ergonomic Office Chair", price=8500, stock=120),
                Product(name="Running Shoes", price=3000, stock=500),
                Product(name="Bluetooth Speaker", price=1500, stock=800),
                Product(name="Premium T-Shirt", price=1000, stock=400),
                Product(name="Mechanical Keyboard", price=4500, stock=250),
                Product(name="USB-C Hub 7-in-1", price=2200, stock=600),
                Product(name="Noise-Cancelling Headphones", price=6500, stock=180),
                Product(name="Portable Power Bank 20000mAh", price=1800, stock=700),
                Product(name="Smart LED Desk Lamp", price=2800, stock=320),
                Product(name="Laptop Stand Aluminum", price=1900, stock=450),
                Product(name="Wireless Mouse Silent Click", price=1200, stock=550),
                Product(name="4K Webcam with Ring Light", price=5200, stock=200),
                Product(name="Stainless Steel Water Bottle", price=800, stock=900),
                Product(name="Yoga Mat Premium 6mm", price=1500, stock=380),
                Product(name="Backpack Laptop 32L", price=3500, stock=280),
                Product(name="Desk Organizer Bamboo", price=1100, stock=420),
                Product(name="HDMI Cable 4K 3m", price=600, stock=1000),
                Product(name="Monitor Stand Riser", price=2400, stock=150),
                Product(name="Coffee Mug Thermo 500ml", price=950, stock=670),
            ]
            db.add_all(products)

        if db.query(MerchantRule).count() == 0:
            db.add(MerchantRule(max_discount_allowed=15))

        if db.query(User).count() == 0:
            db.add(User(username="admin", password="password123", role="merchant"))
            db.add(User(username="buyer1", password="password123", role="buyer"))

        db.commit()
    finally:
        db.close()


class OrderRequest(BaseModel):
    amount: int
    currency: str = "INR"
    product_name: str


class NegotiationRequest(BaseModel):
    product_id: int
    requested_discount_percent: int
    ai_reasoning: str


class CheckoutRequest(BaseModel):
    product_id: int
    final_discounted_price: int
    buyer_username: str


class AgentChatRequest(BaseModel):
    buyer_message: str
    history: list = []
    buyer_username: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str
    expected_role: str


class SignupRequest(BaseModel):
    username: str
    password: str


PRODUCTS = [
    {"id": 1, "name": "Running Shoes", "price": 2999, "currency": "INR", "description": "Premium running shoes for everyday use"},
    {"id": 2, "name": "Sports Socks", "price": 499, "currency": "INR", "description": "Comfortable cotton sports socks"},
    {"id": 3, "name": "Water Bottle", "price": 799, "currency": "INR", "description": "Insulated stainless steel water bottle"},
]


@app.get("/")
def root():
    return {"message": "ChatShop API is running"}


@app.get("/products")
def get_products():
    return {"products": PRODUCTS}


@app.post("/create-order")
def create_order(order: OrderRequest):
    if "YOUR_KEY_ID" in RAZORPAY_KEY_ID or "YOUR_KEY_SECRET" in RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=400, detail="Razorpay API keys not configured. Update backend/.env with your test keys from Razorpay Dashboard.")
    try:
        payment_order = razorpay_client.order.create({
            "amount": order.amount * 100,
            "currency": order.currency,
            "receipt": f"order_{order.product_name.lower().replace(' ', '_')}",
        })
        return {
            "order_id": payment_order["id"],
            "amount": order.amount,
            "currency": order.currency,
            "key_id": RAZORPAY_KEY_ID,
            "product_name": order.product_name,
        }
    except razorpay.errors.BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"Bad request: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")


@app.post("/api/agent/negotiate")
def negotiate(request: NegotiationRequest, db: Session = Depends(get_db)):
    merchant_rule = db.query(MerchantRule).first()

    if request.requested_discount_percent <= merchant_rule.max_discount_allowed:
        action = "Discount Approved"
        log = AIAuditLog(action_taken=action, ai_reasoning=request.ai_reasoning)
        db.add(log)
        db.commit()
        return {"status": "success", "message": "Discount approved"}
    else:
        action = "Discount Rejected - Rule Violated"
        log = AIAuditLog(action_taken=action, ai_reasoning=request.ai_reasoning)
        db.add(log)
        db.commit()
        return {"status": "failed", "message": "Discount exceeds merchant limits"}


@app.post("/api/agent/checkout")
def checkout(request: CheckoutRequest, db: Session = Depends(get_db), buyer: User = Depends(require_buyer)):
    return _generate_payment_link(
        request.product_id, request.final_discounted_price, db, buyer.username
    )


def _apply_discount_rule(product_id: int, requested_discount: int, db: Session) -> dict:
    merchant_rule = db.query(MerchantRule).first()
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"status": "failed", "message": "Product not found"}
    maximum_discount = product.max_discount if product.max_discount is not None else merchant_rule.max_discount_allowed
    if 0 <= requested_discount <= maximum_discount:
        log = AIAuditLog(action_taken="Discount Approved", ai_reasoning=f"LLM approved {requested_discount}% discount on product {product_id}")
        db.add(log)
        db.commit()
        return {"status": "success", "message": f"Discount of {requested_discount}% approved. Final price: ₹{int(1000 * (1 - requested_discount / 100))}"}
    else:
        log = AIAuditLog(action_taken="Discount Rejected - Rule Violated", ai_reasoning=f"LLM rejected {requested_discount}% discount on product {product_id}")
        db.add(log)
        db.commit()
        return {"status": "failed", "message": f"Discount of {requested_discount}% exceeds the maximum allowed {merchant_rule.max_discount_allowed}%."}


def _generate_payment_link(product_id: int, final_price: int, db: Session, buyer_username: str | None = None) -> dict:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"status": "failed", "message": "Product not found"}
    if not RAZORPAY_KEY_ID or RAZORPAY_KEY_ID == "rzp_test_dummy_key" or RAZORPAY_KEY_SECRET == "dummy_secret_key":
        return {
            "status": "configuration_required",
            "message": "Razorpay test keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env to create a real payment link.",
        }

    try:
        link_response = razorpay_client.payment_link.create({
            "amount": final_price * 100,
            "currency": "INR",
            "description": "Payment for " + product.name,
        })
        db.add(PaymentLink(
            razorpay_link_id=link_response["id"],
            short_url=link_response["short_url"],
            product_id=product.id,
            amount=final_price,
            status=link_response.get("status", "created"),
            buyer_username=buyer_username,
        ))
        log = AIAuditLog(action_taken="Payment Link Generated", ai_reasoning=f"LLM generated link for product {product_id} at ₹{final_price}")
        db.add(log)
        db.commit()
        return {"status": "success", "payment_link": link_response['short_url'], "payment_link_id": link_response["id"]}
    except Exception as e:
        log = AIAuditLog(action_taken="Payment Link Failed", ai_reasoning=str(e))
        db.add(log)
        db.commit()
        return {"status": "fallback", "message": "Bank servers are busy. AI Agent has reserved your item. Please try again in 10 minutes."}


def _mark_payment_link_paid(payment_link: PaymentLink, db: Session) -> dict:
    payment_link.status = "paid"
    if payment_link.invoice_number is None:
        payment_link.invoice_number = f"AEGIS-{payment_link.id:06d}"
        payment_link.paid_at = datetime.now(timezone.utc)
        db.add(AIAuditLog(
            action_taken="Invoice Generated",
            ai_reasoning=f"Invoice {payment_link.invoice_number} generated after verified payment link {payment_link.razorpay_link_id}",
        ))
    db.commit()
    product = db.query(Product).filter(Product.id == payment_link.product_id).first()
    return {
        "status": "paid",
        "invoice_number": payment_link.invoice_number,
        "product_name": product.name if product else "Product",
        "amount": payment_link.amount,
        "paid_at": payment_link.paid_at.isoformat() if payment_link.paid_at else None,
    }


def _get_invoice_for_payment_link(payment_link: PaymentLink, db: Session) -> dict:
    if payment_link.status != "paid":
        try:
            razorpay_link = razorpay_client.payment_link.fetch(payment_link.razorpay_link_id)
            payment_link.status = razorpay_link.get("status", payment_link.status)
        except Exception:
            return {"status": "unavailable", "message": "I could not verify the payment status right now. Please try again shortly."}
    if payment_link.status != "paid":
        db.commit()
        return {"status": "pending", "message": "The payment is still pending. Complete payment first, then ask me for the invoice."}
    return _mark_payment_link_paid(payment_link, db)


def _get_invoice_for_product(product_id: int, db: Session) -> dict:
    payment_link = db.query(PaymentLink).filter(PaymentLink.product_id == product_id).order_by(PaymentLink.created_at.desc()).first()
    if payment_link is None:
        return {"status": "not_found", "message": "No payment link was found for this product yet."}
    return _get_invoice_for_payment_link(payment_link, db)


tools = [
    {
        "type": "function",
        "function": {
            "name": "apply_discount_rule",
            "description": "Checks if the requested discount is within merchant limits.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "requested_discount": {"type": "integer"},
                },
                "required": ["product_id", "requested_discount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_payment_link",
            "description": "Generates the Razorpay checkout link for the buyer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "final_price": {"type": "integer"},
                },
                "required": ["product_id", "final_price"],
            },
        },
    },
]

def build_system_prompt(db: Session) -> str:
    products = db.query(Product).all()
    catalog_lines = [
        f"{p.name} (ID: {p.id}, \u20b9{int(p.price)}, {p.stock} in stock)"
        for p in products
    ]
    catalog = "; ".join(catalog_lines)
    return (
        "You are Aegis, a warm, persuasive, and highly intelligent autonomous AI merchant. "
        "You run an online store and your goal is to sell products while making buyers feel valued.\n\n"
        "RULES:\n"
        "- You can offer up to 15% discount on ANY product. Negotiate naturally like a human shopkeeper would.\n"
        "- If a buyer asks for a discount, use apply_discount_rule to check if it is valid before agreeing.\n"
        "- Once you and the buyer agree on a final price, use generate_payment_link to create a checkout link.\n"
        "- Always remember the product and price the buyer is discussing. Do not ask 'which product?' if they already told you.\n"
        "- Be conversational. Use emojis occasionally. Match the buyer's tone.\n"
        "- Reply in the user's language. Understand Hindi, Hinglish, English, and other languages; keep the same level of formality.\n"
        "- If a buyer asks what you sell, list 5-6 items from the catalog, not all of them.\n\n"
        f"CURRENT CATALOG: {catalog}"
    )


def _local_chat_reply(request: AgentChatRequest, db: Session) -> str:
    """Provide useful shopping replies when a hosted AI provider is not configured."""
    products = db.query(Product).all()
    message = request.buyer_message.lower()
    history_text = " ".join(str(item.get("content", "")) for item in request.history[-8:]).lower()
    hinglish = bool(re.search(r"\b(haan|han|nahi|nahin|chahiye|chahiya|karo|karna|do|de|kitna|bhai|yaar|bhugtan|kharid|mujhe)\b", message)) or any("\u0900" <= char <= "\u097f" for char in request.buyer_message)

    selected_product = next(
        (product for product in products if product.name.lower() in message),
        None,
    )
    if selected_product is None:
        selected_product = next(
            (product for product in products if product.name.lower() in history_text),
            None,
        )

    catalog_request = any(word in message for word in ("catalog", "products", "what do you sell", "show me", "browse"))
    if catalog_request and selected_product is None:
        catalog = "\n".join(
            f"- {product.name}: INR {int(product.price)} ({product.stock} in stock)"
            for product in products[:6]
        )
        return f"Here are some items currently available:\n{catalog}\n\nTell me the product name and I will help with pricing or a discount."

    if selected_product is not None:
        rule = db.query(MerchantRule).first()
        maximum_discount = (
            selected_product.max_discount
            if selected_product.max_discount is not None
            else (rule.max_discount_allowed if rule else 15)
        )
        standalone_percentage = re.fullmatch(r"\s*(\d{1,3})\s*%?\s*", message)
        discount_request = bool(re.search(r"\b(discount|off|offer|less|cheap|discounted)\b", message)) or (
            standalone_percentage is not None and "discount" in history_text
        )
        invoice_request = bool(re.search(r"\b(invoice|receipt|bill|rasid|raseed)\b", message))
        payment_request = bool(re.search(r"\b(payment|pay|checkout|payment link|link|bhugtan|kharid|kharido|kharidna|pay karo|link do)\b", message))
        if invoice_request:
            invoice = _get_invoice_for_product(selected_product.id, db)
            if invoice["status"] == "paid":
                if hinglish:
                    return (
                        f"Payment verify ho gaya! Aapka invoice ready hai.\n\n"
                        f"Invoice: {invoice['invoice_number']}\nItem: {invoice['product_name']}\n"
                        f"Amount paid: INR {invoice['amount']}\nPayment date: {invoice['paid_at']}"
                    )
                return (
                    f"Payment verified — your invoice is ready.\n\nInvoice: {invoice['invoice_number']}\n"
                    f"Item: {invoice['product_name']}\nAmount paid: INR {invoice['amount']}\nPayment date: {invoice['paid_at']}"
                )
            return invoice["message"]
        if payment_request:
            approved_prices = re.findall(r"final price:\s*inr\s*(\d+)", history_text)
            final_price = int(approved_prices[-1]) if approved_prices else int(selected_product.price)
            result = _generate_payment_link(selected_product.id, final_price, db, request.buyer_username)
            if result["status"] == "success":
                return (
                    f"Aapka payment link ready hai: {result['payment_link']}\n\n"
                    f"Item: {selected_product.name} | Amount: INR {final_price}\n\n"
                    "Payment complete hone ke baad bas 'invoice do' likh dena — main payment verify karke invoice de dunga."
                    if hinglish else
                    f"Your payment link is ready: {result['payment_link']}\n\nItem: {selected_product.name} | Amount: INR {final_price}\n\n"
                    "After payment, simply say 'invoice please' and I will verify the payment and issue your invoice."
                )
            if result["status"] == "configuration_required":
                return (
                    "Real payment link abhi available nahi hai, kyunki Razorpay test keys configure nahi hain. "
                    "Merchant ko backend/.env mein Razorpay keys add karni hongi."
                    if hinglish else result["message"]
                )
            return "Payment link abhi create nahi ho paya. Kripya thodi der baad try karein." if hinglish else result["message"]
        if discount_request:
            match = re.search(r"\b(\d{1,3})\s*%", message) or standalone_percentage
            if match:
                requested_discount = int(match.group(1))
                if 0 <= requested_discount <= maximum_discount:
                    final_price = int(selected_product.price * (1 - requested_discount / 100))
                    db.add(AIAuditLog(
                        action_taken="Discount Approved",
                        ai_reasoning=f"Local assistant approved {requested_discount}% discount on product {selected_product.id}",
                    ))
                    db.commit()
                    return f"Discount of {requested_discount}% approved. Final price: INR {final_price}. Would you like to proceed with this price?"
                return f"I can offer up to {maximum_discount}% off on {selected_product.name}. Would you like that price instead?"
            discounted_price = int(selected_product.price * (1 - maximum_discount / 100))
            return (
                f"{selected_product.name} is INR {int(selected_product.price)}. "
                f"I can offer up to {maximum_discount}% off, bringing it to INR {discounted_price}. "
                "Tell me the discount percentage you would like."
            )
        if any(word in message for word in ("buy", "want", "purchase", "order", "take", "checkout")):
            return (
                f"Great choice. {selected_product.name} is available for INR {int(selected_product.price)} "
                f"and we have {selected_product.stock} in stock. "
                f"You may ask for a discount (up to {maximum_discount}%) or use the product button below to continue to checkout."
            )
        return (
            f"{selected_product.name} costs INR {int(selected_product.price)} and {selected_product.stock} are in stock. "
            f"I can discuss a discount up to {maximum_discount}% or help you purchase it."
        )

    return "I can help you find a product, check a price, negotiate a discount, or place an order. Ask for the catalog to see available items."


@app.post("/api/agent/chat")
def agent_chat(request: AgentChatRequest, db: Session = Depends(get_db), buyer: User = Depends(require_buyer)):
    # Invoice text is never generated by the LLM. It can only be issued after
    # Razorpay has confirmed a payment for this signed-in buyer.
    if re.search(r"\b(invoice|receipt|bill|rasid|raseed)\b", request.buyer_message.lower()):
        payment_link = db.query(PaymentLink).filter(PaymentLink.buyer_username == buyer.username).order_by(PaymentLink.created_at.desc()).first()
        if payment_link is None:
            return {"reply": "No payment order was found for your account."}
        invoice = _get_invoice_for_payment_link(payment_link, db)
        if invoice["status"] != "paid":
            return {"reply": "Payment is not verified yet, so an invoice cannot be issued. Please complete the Razorpay payment first."}
        return {"reply": f"Payment verified. Your invoice is ready: {invoice['invoice_number']}\nDownload PDF: /api/payment-links/{payment_link.razorpay_link_id}/invoice/download"}
    if groq_client is None:
        request.buyer_username = buyer.username
        return {"reply": _local_chat_reply(request, db)}
    messages = [
        {"role": "system", "content": build_system_prompt(db)},
    ]
    for h in request.history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": request.buyer_message})

    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
    except Exception:
        # A provider outage must not make shopping or payment unavailable.
        request.buyer_username = buyer.username
        return {"reply": _local_chat_reply(request, db)}

    msg = response.choices[0].message
    messages.append({"role": msg.role, "content": msg.content, "tool_calls": msg.tool_calls})

    while msg.tool_calls:
        for tool_call in msg.tool_calls:
            func_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)

            if func_name == "apply_discount_rule":
                result = _apply_discount_rule(args["product_id"], args["requested_discount"], db)
            elif func_name == "generate_payment_link":
                result = _generate_payment_link(args["product_id"], args["final_price"], db, buyer.username)
                # Never let the language model rewrite or invent a payment URL.
                if result["status"] == "success":
                    return {
                        "reply": (
                            f"Your secure Razorpay payment link is ready: {result['payment_link']}\n\n"
                            "Once payment is complete, type 'invoice please' and I will verify it and issue your invoice."
                        )
                    }
            else:
                result = {"status": "error", "message": f"Unknown tool: {func_name}"}

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(result),
            })

        response = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        msg = response.choices[0].message
        messages.append({"role": msg.role, "content": msg.content, "tool_calls": msg.tool_calls})

    return {"reply": _safe_ai_reply(msg.content)}


@app.get("/api/payment-links/{payment_link_id}/invoice")
def get_payment_link_invoice(payment_link_id: str, db: Session = Depends(get_db), buyer: User = Depends(require_buyer)):
    payment_link = db.query(PaymentLink).filter(PaymentLink.razorpay_link_id == payment_link_id, PaymentLink.buyer_username == buyer.username).first()
    if payment_link is None:
        raise HTTPException(status_code=404, detail="Payment link not found")
    result = _get_invoice_for_payment_link(payment_link, db)
    if result["status"] == "paid":
        return result
    if result["status"] == "pending":
        raise HTTPException(status_code=409, detail=result["message"])
    raise HTTPException(status_code=503, detail=result["message"])


def _invoice_pdf(invoice: dict) -> bytes:
    # Small dependency-free PDF suitable for a simple downloadable invoice.
    paid_at = (invoice["paid_at"] or "").replace("T", " ").replace("+00:00", " UTC")
    lines = [
        "AEGIS AI - TAX INVOICE",
        f"Invoice: {invoice['invoice_number']}",
        f"Item: {invoice['product_name']}",
        f"Amount paid: INR {invoice['amount']}",
        f"Payment date: {paid_at}",
        "Payment status: PAID",
    ]
    escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
    stream = "BT /F1 18 Tf 72 740 Td (" + escaped[0] + ") Tj /F1 12 Tf 0 -42 Td "
    stream += " ".join(f"({line}) Tj 0 -24 Td" for line in escaped[1:]) + " ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream.encode('latin-1'))} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = "%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf.encode("latin-1")))
        pdf += f"{index} 0 obj\n{obj}\nendobj\n"
    xref = len(pdf.encode("latin-1"))
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    pdf += "".join(f"{offset:010d} 00000 n \n" for offset in offsets[1:])
    pdf += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
    return pdf.encode("latin-1")


@app.get("/api/payment-links/{payment_link_id}/invoice/download")
def download_payment_link_invoice(payment_link_id: str, db: Session = Depends(get_db), buyer: User = Depends(require_buyer)):
    payment_link = db.query(PaymentLink).filter(PaymentLink.razorpay_link_id == payment_link_id, PaymentLink.buyer_username == buyer.username).first()
    if payment_link is None:
        raise HTTPException(status_code=404, detail="Payment link not found")
    invoice = _get_invoice_for_payment_link(payment_link, db)
    if invoice["status"] != "paid":
        raise HTTPException(status_code=409, detail=invoice["message"])
    return Response(
        _invoice_pdf(invoice), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice['invoice_number']}.pdf"},
    )


@app.post("/api/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="RAZORPAY_WEBHOOK_SECRET is not configured")
    expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=400, detail="Invalid Razorpay webhook signature")
    event = json.loads(body)
    if event.get("event") != "payment_link.paid":
        return {"status": "ignored"}
    link_id = event.get("payload", {}).get("payment_link", {}).get("entity", {}).get("id")
    payment_link = db.query(PaymentLink).filter(PaymentLink.razorpay_link_id == link_id).first()
    if payment_link is None:
        return {"status": "ignored"}
    invoice = _mark_payment_link_paid(payment_link, db)
    return {"status": "invoice_generated", "invoice_number": invoice["invoice_number"]}


@app.get("/api/orders/{buyer_username}")
def get_orders(buyer_username: str, db: Session = Depends(get_db)):
    links = db.query(PaymentLink).filter(PaymentLink.buyer_username == buyer_username).order_by(PaymentLink.created_at.desc()).all()
    return {"orders": [
        {"payment_link_id": link.razorpay_link_id, "product_id": link.product_id, "amount": link.amount,
         "status": link.status, "invoice_number": link.invoice_number, "paid_at": link.paid_at.isoformat() if link.paid_at else None}
        for link in links
    ]}


@app.get("/api/admin/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(AIAuditLog).order_by(AIAuditLog.timestamp.desc()).all()
    return {
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "action_taken": log.action_taken,
                "ai_reasoning": log.ai_reasoning,
            }
            for log in logs
        ]
    }


@app.get("/api/products")
def get_all_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return {
        "products": [
            {"id": p.id, "name": p.name, "price": p.price, "stock": p.stock, "max_discount": p.max_discount}
            for p in products
        ]
    }


class DiscountUpdate(BaseModel):
    max_discount: int


@app.get("/api/admin/settings/discount")
def get_global_discount(db: Session = Depends(get_db)):
    rule = db.query(MerchantRule).first()
    return {"max_discount_allowed": rule.max_discount_allowed if rule else 15}


@app.post("/api/admin/settings/discount")
def update_global_discount(payload: DiscountUpdate, db: Session = Depends(get_db)):
    if not 0 <= payload.max_discount <= 100:
        raise HTTPException(status_code=422, detail="Discount must be between 0 and 100")
    rule = db.query(MerchantRule).first()
    if rule is None:
        rule = MerchantRule(max_discount_allowed=payload.max_discount)
        db.add(rule)
    else:
        rule.max_discount_allowed = payload.max_discount
    db.commit()
    return {"max_discount_allowed": rule.max_discount_allowed}


@app.post("/api/admin/products/{product_id}/discount")
def update_product_discount(product_id: int, payload: DiscountUpdate, db: Session = Depends(get_db)):
    if not 0 <= payload.max_discount <= 100:
        raise HTTPException(status_code=422, detail="Discount must be between 0 and 100")
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.max_discount = payload.max_discount
    db.commit()
    return {"id": product.id, "max_discount": product.max_discount}


@app.get("/api/admin/audit")
def get_audit(db: Session = Depends(get_db)):
    return [
        {"id": log.id, "timestamp": log.timestamp.isoformat(), "action_taken": log.action_taken, "ai_reasoning": log.ai_reasoning}
        for log in db.query(AIAuditLog).order_by(AIAuditLog.timestamp.desc()).all()
    ]


@app.get("/api/admin/analytics")
def get_analytics(db: Session = Depends(get_db)):
    # Webhooks are immediate in production; this reconciliation also covers
    # local development or a webhook that was temporarily unavailable.
    pending_links = db.query(PaymentLink).filter(PaymentLink.status != "paid").order_by(PaymentLink.created_at.desc()).limit(50).all()
    for payment_link in pending_links:
        _get_invoice_for_payment_link(payment_link, db)

    paid_links = db.query(PaymentLink).filter(PaymentLink.status == "paid").all()
    total_revenue = sum(link.amount for link in paid_links)
    now = datetime.now(timezone.utc).date()
    revenue_by_day = {}
    for link in paid_links:
        if link.paid_at:
            day = link.paid_at.astimezone(timezone.utc).date()
            revenue_by_day[day] = revenue_by_day.get(day, 0) + link.amount
    time_series = [
        {"date": (now - timedelta(days=offset)).strftime("%d %b"), "revenue": revenue_by_day.get(now - timedelta(days=offset), 0)}
        for offset in range(6, -1, -1)
    ]
    discount_logs = db.query(AIAuditLog).filter(AIAuditLog.action_taken == "Discount Approved").all()
    discounts = [int(match.group(1)) for log in discount_logs for match in [re.search(r"(\d+)%", log.ai_reasoning)] if match]
    return {
        "metrics": {
            "total_revenue": float(total_revenue),
            "average_discount_given": round(sum(discounts) / len(discounts), 1) if discounts else 0.0,
            "total_links_generated": db.query(PaymentLink).count(),
            "paid_orders": len(paid_links),
        },
        "time_series": time_series,
    }


@app.get("/.well-known/agent-catalog.json")
def get_agent_catalog(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return {
        "store_name": "Aegis AI",
        "agent_protocol_version": "UAP-1.0",
        "catalog": [
            {"id": p.id, "name": p.name, "price": p.price, "stock": p.stock}
            for p in products
        ],
    }


@app.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    if request.expected_role not in ("merchant", "buyer"):
        raise HTTPException(status_code=400, detail="Invalid login portal")
    user = db.query(User).filter(User.username == request.username).first()

    if not user or not _verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.password.startswith("pbkdf2_sha256$"):
        user.password = _password_hash(request.password)
        db.commit()
    if user.role != request.expected_role:
        raise HTTPException(status_code=403, detail=f"This account belongs to the {user.role} portal")

    return {
        "status": "success",
        "user": {"id": user.id, "username": user.username, "role": user.role}, "token": _create_session(user),
    }


@app.post("/api/auth/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Merchant accounts are provisioned by the platform, never from a public buyer form.
    user = User(username=request.username, password=_password_hash(request.password), role="buyer")
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "user": {"id": user.id, "username": user.username, "role": user.role}, "token": _create_session(user),
    }


@app.post("/api/admin/upload-catalog")
async def upload_catalog(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    try:
        content = await file.read()
        decoded = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        expected_columns = {"name", "price", "stock"}
        if not reader.fieldnames or not expected_columns.issubset({column.strip().lower() for column in reader.fieldnames if column}):
            raise HTTPException(status_code=400, detail="CSV must include these headers: name,price,stock")

        imported = 0
        skipped = 0
        for row in reader:
            # DictReader returns None for missing cells; treat those rows as invalid,
            # rather than failing the entire upload.
            normalized = {
                (str(key) if key is not None else "").strip().lower(): str(value or "").strip()
                for key, value in row.items()
            }
            name = normalized.get("name", "")
            price_str = normalized.get("price", "")
            stock_str = normalized.get("stock", "")

            if not name:
                skipped += 1
                continue

            try:
                price = float(price_str)
                stock = int(stock_str)
            except ValueError:
                skipped += 1
                continue
            if not math.isfinite(price) or price < 0 or stock < 0:
                skipped += 1
                continue

            existing = db.query(Product).filter(Product.name == name).first()
            if existing:
                existing.price = price
                existing.stock = stock
            else:
                db.add(Product(name=name, price=price, stock=stock))

            imported += 1

        db.commit()
        message = f"{imported} products synced successfully"
        if skipped:
            message += f"; {skipped} invalid row(s) skipped"
        return {"status": "success", "imported": imported, "skipped": skipped, "message": message}
    except HTTPException:
        db.rollback()
        raise
    except UnicodeDecodeError:
        db.rollback()
        raise HTTPException(status_code=400, detail="CSV must be saved with UTF-8 encoding")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Catalog could not be saved. Please try the upload again.") from e
