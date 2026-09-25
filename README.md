# ResumeLoop

ResumeLoop is a college peer resume-review platform built around a simple loop:

**Give feedback → Get feedback → Improve your resume**

Students can sign in with a Supabase magic link, create a student profile, upload private PDF/DOCX resume versions, review a peer's assigned resume, and receive structured feedback.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Authentication / Database / Storage:** Supabase
- **Backend:** Python + FastAPI
- **Repository:** GitHub

## Core Features

### Student
- Magic-link authentication
- Student profile
- Resume version uploads
- Private resume storage
- Peer resume assignments
- Structured peer review
- Feedback received
- Personal dashboard

### Admin
- Platform overview
- Student management
- Resume management
- Review management
- Report management
- Admin access control

## Environment Variables

The real environment file is intentionally **not** stored in GitHub.

For local development:

```bash
cd frontend
cp .env.example .env.local
```

Then add your Supabase project URL and publishable key to `.env.local`.

**Never commit real Supabase keys, SMTP credentials, service-role keys, or other secrets.**

## Run Locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv venv
# Linux/macOS
source venv/bin/activate
# Windows
# venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Project Screenshots

![ResumeLoop UI screenshots](docs/screenshots/resumeloop-screenshots-gallery.jpg)

The screenshots show the authentication flow, student dashboard, resume upload, peer review, feedback, profile, and admin workspace.

## Security Notes

- Supabase Row Level Security (RLS) protects database access.
- Resume files are stored in a private Supabase Storage bucket.
- Frontend uses the Supabase publishable key only.
- Real environment variables and secrets must stay outside the repository.
