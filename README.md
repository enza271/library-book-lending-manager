# Library Book Lending Manager

A MERN application for cataloguing library books, issuing and returning loans, tracking overdue books, and calculating fines.

## Project structure

- `frontend/` — React + Vite user interface
- `backend/` — Express REST API and Mongoose models

## Run with VS Code

Prerequisites: Node.js 18+ and access to a MongoDB Atlas database.

1. Clone this repository and open its folder in VS Code.
2. In VS Code, choose **Terminal → New Terminal** and run:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

   The API starts at `http://localhost:5000`. Keep this terminal running. If MongoDB fails to connect, verify the Atlas database user, password, and Network Access IP allowlist.

3. Open a second VS Code terminal (**Terminal → New Terminal**) and run:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open the Vite URL printed in the terminal, normally `http://localhost:5173`.

Do not commit real database credentials. Put your own `MONGODB_URI` in `backend/.env`; the committed exam URI should only be used if it is a disposable test account. The frontend API URL defaults to `http://localhost:5000/api` and can be changed with `frontend/.env` (`VITE_API_URL`).

## API

All responses use `{ "success": boolean, "message": string, "data": any }`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API availability |
| GET | `/api/books?page=1&category=Fiction&available=true&search=word` | Search/filter books; five per page |
| POST | `/api/books` | Add a book |
| GET | `/api/books/:id` | Book details and loan history |
| PUT | `/api/books/:id` | Edit title, author, and copy count |
| DELETE | `/api/books/:id` | Delete a book if no loan is active |
| POST | `/api/books/:id/issue` | Issue an available copy to a member |
| POST | `/api/loans/:loanId/return` | Return a loan and calculate late fine |
| GET | `/api/stats` | Dashboard statistics |

## Screenshots

Add two screenshots of the running application before submission, for example:

- `docs/screenshots/dashboard.png` — book list and statistics.
- `docs/screenshots/loan-history.png` — a book detail page with loan history.

## Build frontend

```bash
cd frontend
npm run build
```
