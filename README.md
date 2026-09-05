# Razorpay Frontend

A sleek, responsive frontend for Razorpay payment integration, built with modern web technologies. Experience seamless payments with a polished user interface.

![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel)
[https://frontend-h3frd9xz5-basant-gautams-projects.vercel.app/](https://frontend-h3frd9xz5-basant-gautams-projects.vercel.app/)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [License](#license)

## Overview

This project provides a beautiful, interactive frontend for Razorpay's payment gateway. It includes a product catalog, cart functionality, and a smooth checkout experience built with React, Vite, and Tailwind CSS.

## Features

- 🎨 Modern, minimal UI with smooth animations
- 🛒 Product catalog with add-to-cart functionality
- 💳 Integrated Razorpay checkout
- 📱 Fully responsive design (mobile-first)
- 🔐 Environment-based configuration for test keys

## Tech Stack

- [React](https://reactjs.org/) - UI library
- [Vite](https://vitejs.dev/) - Fast development server & build
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Razorpay JS SDK](https://razorpay.com/) - Payment processing

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Razorpay test keys (sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/razorpay-frontend.git
cd razorpay-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Razorpay test keys

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

## Deployment

This project is configured for easy deployment on Vercel. The `vercel.json` file handles redirect rules and asset optimization.

To deploy:

```bash
vercel
# Or connect your GitHub repository to Vercel for automatic deployments
```

## License

This project is licensed under the MIT License.

---

Built with ❤️ by Basant Gautam