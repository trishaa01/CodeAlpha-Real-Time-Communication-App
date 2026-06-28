# NexLink — Real-Time Communication Platform

> A full-stack, multi-service Real-Time communication application featuring WebRTC peer-to-peer video calls, real-time collaborative whiteboard, encrypted file sharing, and live group chat — all in one room.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend — Django REST API](#backend--django-rest-api)
  - [Backend — Node.js Signaling Server](#backend--nodejs-signaling-server)
  - [Frontend — React + Vite](#frontend--react--vite)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Screenshots](#screenshots)

---

## Overview

NexLink is a production-ready, multi-service video conferencing platform built as **Internship Task 4**. It enables users to create or join private rooms where they can:

- Video/audio call peers directly via **WebRTC**
- Draw and collaborate in real time on a **shared whiteboard**
- Send and receive **encrypted files** securely
- Chat with room participants via a **live messaging panel**

The platform is architected as three independent, deployable services — a **Django REST API**, a **Node.js Socket.IO signaling server**, and a **React + TypeScript frontend** — connected through JWT authentication and WebSockets.

---

## Features

| Feature | Description |
|---|---|
| 🎥 WebRTC Video Calls | Peer-to-peer audio/video via WebRTC with Socket.IO signaling |
| 🖊️ Collaborative Whiteboard | Real-time drawing synchronised across all room participants |
| 💬 Live Group Chat | In-room messaging broadcast instantly to all connected users |
| 🔒 Encrypted File Sharing | Per-file Fernet encryption with secure download via Django REST API |
| 🛡️ JWT Authentication | Token-based auth (access + refresh) via `djangorestframework-simplejwt` |
| 🏠 Room Management | Create private rooms with unique codes; verify membership before entry |
| 📱 Responsive UI | Clean, responsive React interface built with TypeScript |

---

## Tech Stack

### Frontend
- **React 19** with **TypeScript**
- **Vite 8** (build tool)
- **React Router DOM v7** (client-side routing)
- **Socket.IO Client** (WebSocket communication)
- **Lucide React** (icons)

### Backend — Django REST API
- **Django 5+** with **Django REST Framework**
- **SimpleJWT** (`djangorestframework-simplejwt`) for auth
- **django-cors-headers** for CORS management
- **Pillow** for image handling
- **cryptography (Fernet)** for file encryption
- **Gunicorn** as production WSGI server
- **PostgreSQL** (production) / **SQLite** (development)

### Backend — Node.js Signaling Server
- **Node.js** with **Express**
- **Socket.IO** for real-time, bidirectional WebSocket events
- **dotenv** for environment config

### Infrastructure
- **Render.com** (deployment via `render.yaml`)
- **PostgreSQL** on Render free tier

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│           (Vite + TypeScript + React 19)         │
│  - Pages: Auth, Dashboard, Room                  │
│  - Components: VideoGrid, Chat, Whiteboard,      │
│    FileShare                                     │
└──────────┬──────────────────┬───────────────────┘
           │  REST API        │  WebSocket (Socket.IO)
           ▼                  ▼
┌──────────────────┐  ┌──────────────────────────┐
│  Django REST API │  │  Node.js Signaling Server │
│  (Gunicorn)      │  │  (Express + Socket.IO)    │
│  - Auth (JWT)    │  │  - WebRTC offer/answer    │
│  - Room CRUD     │  │  - ICE candidate relay    │
│  - File upload/  │  │  - Chat broadcast         │
│    download      │  │  - Whiteboard sync        │
│  - Encryption    │  │  - File upload notify     │
└────────┬─────────┘  └──────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │  PostgreSQL   │
  │  (Render DB)  │
  └──────────────┘
```

### Socket.IO Events

| Event (Client → Server) | Description |
|---|---|
| `join-room` | Join a room by ID |
| `send-signal` | Relay WebRTC offer/answer/ICE to a peer |
| `send-message` | Send a chat message to the room |
| `draw-stroke` | Broadcast a whiteboard draw event |
| `clear-whiteboard` | Clear the whiteboard for all participants |
| `file-uploaded-notify` | Notify room of a new file upload |

| Event (Server → Client) | Description |
|---|---|
| `all-users-in-room` | List of peers already in the room |
| `user-joined` | A new user connected |
| `receive-signal` | Incoming WebRTC signal from a peer |
| `new-message` | Incoming chat message |
| `receive-stroke` | Incoming whiteboard draw data |
| `user-disconnected` | A peer left the room |

---

## Project Structure

```
nexlink/
├── render.yaml                  # Render deployment config (all 3 services)
│
├── backend-django/              # Django REST API
│   ├── manage.py
│   ├── requirements.txt
│   ├── nexlink/                 # Django project settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── api/                     # Core Django app
│       ├── models.py            # Room, SharedFile models
│       ├── views.py             # API views (auth, rooms, files)
│       ├── urls.py              # URL routing
│       └── serializers.py
│
├── backend-node/                # Node.js Signaling Server
│   ├── server.js                # Express + Socket.IO server
│   └── package.json
│
└── frontend/                    # React + TypeScript App
    ├── index.html
    ├── vite.config.ts
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── pages/
    │   │   ├── Auth.tsx         # Login / Signup
    │   │   ├── Dashboard.tsx    # Create / join rooms
    │   │   └── Room.tsx         # The main conference room
    │   ├── components/
    │   │   ├── VideoGrid.tsx    # WebRTC video tiles
    │   │   ├── Chat.tsx         # Live chat panel
    │   │   ├── Whiteboard.tsx   # Collaborative drawing canvas
    │   │   └── FileShare.tsx    # Encrypted file upload/download
    │   └── services/
    │       └── api.ts           # Axios REST client
    └── package.json
```

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **npm** or **yarn**
- (Optional) **PostgreSQL** for production; SQLite works for local dev

---

### Backend — Django REST API

```bash
# Navigate to Django backend
cd backend-django

# Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# (Optional) Create a superuser for Django Admin
python manage.py createsuperuser

# Start the development server
python manage.py runserver
```

The Django API will be available at `http://localhost:8000`.

---

### Backend — Node.js Signaling Server

```bash
# Navigate to Node.js backend
cd backend-node

# Install dependencies
npm install

# Start the server (production)
npm start

# Or with auto-reload during development
npm run dev
```

The signaling server will be available at `http://localhost:5000`.

---

### Frontend — React + Vite

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The React app will be available at `http://localhost:5173`.

> **Note:** Make sure both backend services are running before using the frontend.

---

## Environment Variables

### Django (`backend-django/.env`)

```env
SECRET_KEY=your-django-secret-key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3    # or your PostgreSQL connection string
ALLOWED_HOSTS=*
```

### Node.js (`backend-node/.env`)

```env
PORT=5000
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## API Endpoints

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/signup/` | Register a new user |
| `POST` | `/api/auth/login/` | Obtain JWT access + refresh tokens |
| `POST` | `/api/auth/refresh/` | Refresh access token |
| `GET` | `/api/auth/profile/` | Get authenticated user profile |

### Rooms

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rooms/create/` | Create a new room |
| `GET` | `/api/rooms/verify/<room_id>/` | Verify a room exists |

### Files

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rooms/<room_id>/files/` | List files in a room |
| `POST` | `/api/rooms/<room_id>/files/upload/` | Upload and encrypt a file |
| `GET` | `/api/files/download/<file_id>/` | Download and decrypt a file |

> All endpoints except signup and login require a valid JWT `Authorization: Bearer <token>` header.

---

## Deployment

NexLink is configured for one-click deployment on **Render** using the included `render.yaml`.

The config provisions three services and a PostgreSQL database automatically:

| Service | Type | Description |
|---|---|---|
| `nexlink-api` | Web (Python) | Django REST API with Gunicorn |
| `nexlink-signaling-server` | Web (Node.js) | Socket.IO signaling server |
| `nexlink-frontend-app` | Static site | React frontend (SPA) |
| `nexlink-postgres-db` | Database | PostgreSQL instance |

To deploy:

1. Push this repository to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo.
4. Render will detect `render.yaml` and provision all services automatically.
5. Update the frontend environment variables with the live API and signaling server URLs after deployment.

---

## Screenshots

> *(Screenshots will be added after deployment)*

---

## Author

**Trisha** — B.Tech CSE (AI/ML), NIET Greater Noida  
Internship Task 4 — Full-Stack Real-Time Application

---

## License

This project is built for internship learning purposes.
