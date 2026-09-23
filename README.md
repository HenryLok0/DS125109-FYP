# EaseParkHK

EaseParkHK (泊易香港) is a Flask-based car park vacancy system that provides real-time vacancy information for car parks in various districts of Hong Kong.

## Features

- Real-time vacancy information for car parks in Hong Kong
- Filter car parks by vehicle type
- Display detailed information about car parks, including address, contact information, and website
- Map view to show car park locations

## Project structure

- `app/` — Flask application (routes, models, templates, translations)
- `migrations/` — database migrations
- `requirements.txt` — pinned Python packages
- `run.py` — application entry point
- `.env.example` — environment variable template

## Installation and setup

Use Python 3.9. The pinned packages in `requirements.txt` do not install on Python 3.14. On this machine, `python` is 3.14, so create the virtual environment with `py -3.9`.

1. Clone the repository:

    ```powershell
    git clone https://github.com/HenryLok0/DS125109-FYP.git
    cd DS125109-FYP
    ```

2. Create and activate a Python 3.9 virtual environment:

    ```powershell
    py -3.9 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    ```

3. Install the required packages:

    ```powershell
    python -m pip install -r requirements.txt
    ```

4. Copy `.env.example` to `.env` and fill in your own values. Do not commit `.env`.

    ```powershell
    copy .env.example .env
    ```

    - `SECRET_KEY`: a random secret used to sign sessions
    - `SQLALCHEMY_DATABASE_URI`: local SQLite by default, or your own database URL
    - `GEMINI_API_KEY`: Google Gemini API key. The app reads this when it starts, so the server will not boot if it is missing.
    - `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`: SMTP settings for password-reset email. Local MailHog defaults are in `.env.example`.

5. Run the application from the activated virtual environment:

    ```powershell
    flask --debug run --host=0.0.0.0
    ```

    Open `http://localhost:5000`.

6. Optional: load sample account data:

    ```powershell
    python test_data.py
    ```

## Usage

- Open `http://localhost:5000`.
- Use the navigation bar to select a district and view real-time car park vacancy information.
- Use the filter options to filter car parks by vehicle type.

## License

This project is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.
