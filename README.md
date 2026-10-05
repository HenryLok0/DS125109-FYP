# EaseParkHK

EaseParkHK (泊易香港) is a Flask web app that shows live car park vacancy data for Hong Kong. It uses the [DATA.GOV.HK car park APIs](https://data.gov.hk/) and Transport Department open data.

English home: `http://localhost:5000`  
Chinese home: `http://localhost:5000/zh`

## Features

- Live vacancy for private cars, motorcycles, LGV, HGV, and coaches
- Filter by vehicle type and opening status
- District pages for Hong Kong Island, Kowloon, and the New Territories
- Car park detail pages with address and map
- Metered parking space lists from Transport Department Excel files
- Traffic cameras and special traffic news
- Favourites (stored in the browser session)
- English / Traditional Chinese
- Light and dark theme
- One-stop map (car parks, meter locations, cameras) and a parking assistant
- GitHub Pages hosting from the `docs/` folder. No API key and no database are required

## Requirements

- **Python 3.9**. The packages in `requirements.txt` do not install on Python 3.14.
- On Windows, if `python` is 3.14, create the virtual environment with `py -3.9`.
- `GEMINI_API_KEY` is optional. The site answers from government vacancy data and starts without it.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | Flask app: routes, models, templates, translations |
| `app/govdata.py` | Cached fetches for government APIs and Excel files |
| `migrations/` | Database migrations |
| `requirements.txt` | Pinned Python packages |
| `run.py` | Alternative entry point |
| `.env.example` | Environment variable template |
| `test_data.py` | Optional sample account data |

## Setup (Windows PowerShell)

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

3. Install packages:

    ```powershell
    python -m pip install -r requirements.txt
    ```

4. Copy `.env.example` to `.env` and edit the values. Do not commit `.env`.

    ```powershell
    copy .env.example .env
    ```

    | Variable | Purpose |
    | --- | --- |
    | `SECRET_KEY` | Random string used to sign sessions |
    | `SQLALCHEMY_DATABASE_URI` | SQLite by default, or your own database URL |
    | `GEMINI_API_KEY` | Optional. Leave the placeholder if you are not calling Gemini |
    | `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP for password-reset email. MailHog defaults are in `.env.example` |

5. Start the server from the activated virtual environment:

    ```powershell
    python -m flask --debug run --host=0.0.0.0
    ```

    Open [http://localhost:5000](http://localhost:5000).

    Prefer `python -m flask` over `flask`. On some Windows machines, Application Control Policy blocks `.venv\Scripts\flask.exe`.

    For a faster run without the debugger:

    ```powershell
    python -m flask run --host=0.0.0.0
    ```

## Usage

- Open [http://localhost:5000](http://localhost:5000) (English) or [http://localhost:5000/zh](http://localhost:5000/zh) (繁體中文).
- Use the navigation bar to pick a district, metered parking, cameras, or news.
- Use the filters on the home page to narrow car parks by vehicle type and status.
- Toggle light / dark theme from the icon on the right of the navigation bar.

Government vacancy data is cached for about 60 seconds so repeat page loads do not wait on the public APIs every time.

## GitHub Pages

GitHub Pages cannot run the Flask app. The public site is the static page in `docs/`. It reads Hong Kong open data in the browser, so it does not need a database or an API key.

After this folder is on `main`, open the repository on GitHub → Settings → Pages → Build and deployment → Source: GitHub Actions. The workflow `.github/workflows/pages.yml` publishes `docs/`. The site address looks like `https://henrylok0.github.io/DS125109-FYP/`.

`.github/workflows/vacancy-hour.yml` saves one vacancy snapshot every hour, including when nobody has the page open. The map shows a same-hour average only after three earlier snapshots exist.

The Flask app on your computer uses the same map at `/map` and `/zh/map`.

## License

MIT. See [`LICENSE`](LICENSE).
