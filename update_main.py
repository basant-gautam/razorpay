import re

with open('e:/code/razorpay/main.py', 'r') as f:
    content = f.read()

# 1. Add CORSMiddleware import
if 'CORSMiddleware' not in content:
    content = content.replace(
        'from fastapi import FastAPI, Depends, HTTPException, Body',
        'from fastapi import FastAPI, Depends, HTTPException, Body\nfrom fastapi.middleware.cors import CORSMiddleware'
    )

# 2. Add CORSMiddleware configuration
if 'app.add_middleware' not in content:
    content = content.replace(
        'app = FastAPI(title="Aegis AI System")',
        'app = FastAPI(title="Aegis AI System")\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["*"],\n    allow_credentials=True,\n    allow_methods=["*"],\n    allow_headers=["*"],\n)'
    )

# 3. Add auth schemas and endpoints if not present
endpoints = """
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
"""

if '/api/auth/signup' not in content:
    content += "\n" + endpoints

with open('e:/code/razorpay/main.py', 'w') as f:
    f.write(content)
