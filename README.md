# Projekt Zespołowy - Drużyna Pierścienia
## Zespół:
* Adam Salej - Backend
* Bartłomiej Załuska - Fullstack + integracja
* Tomasz Jakubiak - Frontend
* Łukasz Ostrówka - Game design + UX

## Technologie i narzędzia:
* #### Frontend: Angular (TypeScript)
* #### Backend: Django (Python)
* #### Komunikacja: REST API
* #### Baza danych: SQLite



# JAK ODPALIĆ:
### 0. Pobranie projektu
Jeśli jeszcze tego nie zrobiłeś, sklonuj repozytorium na swój komputer:
```bash
git clone https://github.com/asalejuwm/ProjektZespolowy_DruzynaPierscienia.git
cd ProjektZespolowy_DruzynaPierscienia
```

### 1. Wymagania wstępne
* Python (wersja 3.x)
* Node.js (wersja LTS)
* Git

### 2. Instalacja Backend (Django)
Przejdź do folderu backend
```
cd backend
```
Stwórz wirtualne środowisko
```
python -m venv venv
# (jeśli prefix 'python' nie działa, spróbuj 'py' lub 'py -3')
```
Aktywuj środowisko (Windows)
```
.\venv\Scripts\activate
```
Zainstaluj wymagane paczki
```
pip install -r requirements.txt
```
Wykonaj migracje
```
python manage.py migrate
```
Stwórz własne konto administratora
```
python manage.py createsuperuser
```
Uruchom serwer
```
python manage.py runserver
```

### 3. Instalacja Frontend (Angular)
Przejdź do folderu angular-app
```
cd ../angular-app
# (droga z folderu backend)
```

Zainstaluj paczki
```
npm install
```
Uruchom aplikację
```
npx ng serve
```

### 4. Dobre praktyki przy pracy
* Nowe biblioteki (Python): Po zainstalowaniu nowej paczki w backendzie, pamiętaj o aktualizacji pliku wymagań:
```
pip freeze > requirements.txt.
```
* Nowe biblioteki (Angular): npm install nazwa-paczki automatycznie zaktualizuje package.json, który wrzucasz na GitHuba.
* Pamiętaj, żeby wrzucić plik db.sqlite3 do .gitignore przed pushnięciem na GitHuba.






