from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Float, create_engine, func
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

DATABASE_URL = "sqlite:///./aegis.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    max_discount = Column(Integer, nullable=True)  # Overrides global rule if set


class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id = Column(Integer, primary_key=True, index=True)
    max_discount_allowed = Column(Integer, nullable=False, default=15)  # e.g. 15 means 15%


class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_taken = Column(String, nullable=False)
    ai_reasoning = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class Order(Base):
    """Tracks completed orders for analytics."""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, nullable=False)
    revenue = Column(Float, nullable=False)
    discount_given = Column(Integer, nullable=False, default=0)  # Percentage given
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


# ---------------------------------------------------------------------------
# AI System Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are Aegis, a friendly, human-like shopkeeper. You negotiate naturally. 
RULE 1: NEVER reveal your maximum allowed discount immediately. 
RULE 2: If the max discount allowed is 15%, and the user asks for a discount, start by offering a small token discount (e.g., 5%) and highlight the premium quality of the product. 
RULE 3: If the user pushes back or asks for more, act slightly hesitant but increase it to 10% to make them feel special ('Just for you, I can do 10%'). 
RULE 4: Only give the absolute maximum allowed limit if they threaten to leave or drive a very hard bargain. 
Keep the conversation natural, slightly conversational, and never sound robotic."""


# ---------------------------------------------------------------------------
# App & Dependencies
# ---------------------------------------------------------------------------

app = FastAPI(title="Aegis AI System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def create_tables() -> None:
    """Create all database tables on application startup."""
    Base.metadata.create_all(bind=engine)
    
    # Initialize a default merchant rule if none exists
    db = SessionLocal()
    if not db.query(MerchantRule).first():
        db.add(MerchantRule(max_discount_allowed=15))
        db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DiscountUpdate(BaseModel):
    max_discount: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    """Health-check / welcome endpoint."""
    return {"message": "Aegis AI System is running"}


@app.post("/api/admin/settings/discount")
def update_global_discount(payload: DiscountUpdate, db: Session = Depends(get_db)):
    """Update the global maximum discount allowed."""
    rule = db.query(MerchantRule).first()
    if not rule:
        rule = MerchantRule(max_discount_allowed=payload.max_discount)
        db.add(rule)
    else:
        rule.max_discount_allowed = payload.max_discount
    
    db.commit()
    db.refresh(rule)
    return {"message": "Global discount updated successfully", "max_discount_allowed": rule.max_discount_allowed}


@app.post("/api/admin/products/{product_id}/discount")
def update_product_discount(product_id: int, payload: DiscountUpdate, db: Session = Depends(get_db)):
    """Update the maximum discount for a specific product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.max_discount = payload.max_discount
    db.commit()
    db.refresh(product)
    return {"message": f"Discount updated for product {product.name}", "max_discount": product.max_discount}


@app.get("/api/admin/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Get metrics and time-series data for the last 7 days."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Base queries filtered by last 7 days
    recent_orders = db.query(Order).filter(Order.timestamp >= seven_days_ago).all()
    
    # 1. Total revenue
    total_revenue = sum(order.revenue for order in recent_orders)
    
    # 2. Average discount
    total_discounts = sum(order.discount_given for order in recent_orders)
    avg_discount = total_discounts / len(recent_orders) if recent_orders else 0
    
    # 3. Total links generated (assuming AIAuditLog logs "generate_link" actions)
    total_links = db.query(AIAuditLog).filter(
        AIAuditLog.timestamp >= seven_days_ago,
        AIAuditLog.action_taken == "generate_link"
    ).count()

    # 4. Time-series array (Group by day)
    # Initialize the last 7 days dictionary to ensure missing days have 0s
    time_series_map = {}
    for i in range(7, -1, -1):
        day_str = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        time_series_map[day_str] = {"sales": 0, "revenue": 0.0}

    for order in recent_orders:
        day_str = order.timestamp.strftime("%Y-%m-%d")
        if day_str in time_series_map:
            time_series_map[day_str]["sales"] += 1
            time_series_map[day_str]["revenue"] += order.revenue
            
    # Convert map to sorted list
    time_series = [{"date": k, **v} for k, v in time_series_map.items()]

    return {
        "metrics": {
            "total_revenue": total_revenue,
            "average_discount_given": round(avg_discount, 2),
            "total_links_generated": total_links
        },
        "time_series": time_series
    }

@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@app.get("/api/admin/audit")
def get_audit_logs(db: Session = Depends(get_db)):
    return db.query(AIAuditLog).order_by(AIAuditLog.timestamp.desc()).all()

@app.get("/api/admin/settings/discount")
def get_global_discount(db: Session = Depends(get_db)):
    rule = db.query(MerchantRule).first()
    return {"max_discount_allowed": rule.max_discount_allowed if rule else 15}


class AuthUser(BaseModel):
    username: str
    password: str
    role: str = "buyer"

@app.post("/api/auth/signup")
def signup(user: AuthUser):
    # Dummy mock for frontend
    return {"id": 1, "username": user.username, "role": user.role}

@app.post("/api/auth/login")
def login(user: AuthUser):
    # Dummy mock for frontend
    return {"id": 1, "username": user.username, "role": user.role}

class ChatMessage(BaseModel):
    message: str

@app.post("/api/agent/chat")
def chat(payload: ChatMessage):
    # Very simple dummy mock for frontend chat
    return {"reply": "I am Aegis. Welcome to our emporium. " + payload.message}

@app.post("/api/agent/checkout")
def checkout():
    return {"link": "https://rzp.io/l/dummy"}
