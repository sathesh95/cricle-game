import json
import os
from flask import Flask, render_template, request, jsonify, session
from datetime import datetime, date, timedelta
import pytz # For IST timezone handling
import random

app = Flask(__name__)
# IMPORTANT: Set a secret key for session management
app.secret_key = 'a-very-secret-string-for-cricle-game'

# --- Constants ---
MAX_GUESSES = 5
CRICKETERS_FILE = 'cricketers.json'
INDIA_TZ = pytz.timezone('Asia/Kolkata')

# --- Load Cricketer Data ---
def load_cricketers():
    try:
        with open(CRICKETERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: {CRICKETERS_FILE} not found!")
        return []
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {CRICKETERS_FILE}")
        return []

cricketers_data = load_cricketers()
cricketer_names = sorted([c['name'] for c in cricketers_data]) # For autocomplete

# --- Game Logic ---
def get_ist_today():
    """Gets the current date in IST."""
    return datetime.now(INDIA_TZ).date()

def get_todays_cricketer_index(today_date):
    """Determines the index of the mystery cricketer for a given date."""
    if not cricketers_data:
        return -1 # No data loaded
    # Use the day of the year as a seed for daily rotation
    day_of_year = today_date.timetuple().tm_yday
    # Simple deterministic selection based on date - ensures same player all day
    index = (day_of_year + today_date.year) % len(cricketers_data)
    return index

def get_cricketer_by_name(name):
    """Finds a cricketer dict by name (case-insensitive search)."""
    for cricketer in cricketers_data:
        if cricketer['name'].lower() == name.lower():
            return cricketer
    return None

def compare_cricketers(guessed, mystery):
    """Compares attributes of guessed vs mystery cricketer."""
    comparison = {
        'debut_year': guessed.get('debut_year') == mystery.get('debut_year'),
        'country_playing': guessed.get('country_playing') == mystery.get('country_playing'),
        'country_born': guessed.get('country_born') == mystery.get('country_born'),
        'type': guessed.get('type') == mystery.get('type'),
        'ipl_team': guessed.get('ipl_team') == mystery.get('ipl_team'),
    }
    # Check if all attributes match
    correct_guess = all(comparison.values())
    return comparison, correct_guess

def reset_daily_game():
    """Resets session variables for a new day's game."""
    today_date_str = get_ist_today().isoformat()
    session['game_date'] = today_date_str
    session['mystery_cricketer_index'] = get_todays_cricketer_index(date.fromisoformat(today_date_str))
    session['guesses'] = []
    session['game_won'] = False
    session['game_lost'] = False
    print(f"Starting new game for date: {today_date_str}, Mystery Index: {session['mystery_cricketer_index']}")
    if session['mystery_cricketer_index'] != -1:
         print(f"Today's Cricketer: {cricketers_data[session['mystery_cricketer_index']]['name']}") # Log for debugging


# --- Flask Routes ---
@app.before_request
def check_daily_reset():
    """Checks if the game date needs to be reset before handling a request."""
    today_date_str = get_ist_today().isoformat()
    if 'game_date' not in session or session['game_date'] != today_date_str:
        reset_daily_game()

@app.route('/')
def index():
    """Renders the main game page."""
    if not cricketers_data:
         return "Error: Cricketer data could not be loaded.", 500

    if session.get('mystery_cricketer_index', -1) == -1:
         reset_daily_game() # Ensure game is initialized if index is somehow lost

    # Pass necessary info, but NOT the answer itself
    return render_template('index.html', all_cricketer_names=cricketer_names)

@app.route('/guess', methods=['POST'])
def handle_guess():
    """Handles a user's guess."""
    if not cricketers_data or session.get('mystery_cricketer_index', -1) == -1:
        return jsonify({'error': 'Game not initialized or data missing.'}), 500

    mystery_index = session['mystery_cricketer_index']
    mystery_cricketer = cricketers_data[mystery_index]

    if session.get('game_won') or session.get('game_lost'):
        return jsonify({'error': 'Game already finished for today.'}), 400

    if len(session.get('guesses', [])) >= MAX_GUESSES:
         session['game_lost'] = True # Mark as lost if somehow tried guessing again
         return jsonify({'error': 'No more guesses remaining.'}), 400

    data = request.get_json()
    guessed_name = data.get('name')

    if not guessed_name:
        return jsonify({'error': 'No cricketer name provided.'}), 400

    guessed_cricketer = get_cricketer_by_name(guessed_name)

    if not guessed_cricketer:
        # Even if autocomplete is used, double check server-side
        return jsonify({'error': f'Cricketer "{guessed_name}" not found in database.'}), 404

    comparison, correct_guess = compare_cricketers(guessed_cricketer, mystery_cricketer)

    # Store the guess details in the session
    session['guesses'].append({
        'name': guessed_cricketer['name'], # Use correct casing from data
        'comparison': comparison
    })
    session.modified = True # Important when modifying mutable types in session

    response = {
        'guessed_cricketer': guessed_cricketer, # Send back full details of the guess
        'comparison': comparison,
        'correct_guess': correct_guess,
        'guesses_remaining': MAX_GUESSES - len(session['guesses']),
    }

    if correct_guess:
        session['game_won'] = True
        session.modified = True
    elif len(session['guesses']) >= MAX_GUESSES:
        session['game_lost'] = True
        session.modified = True
        response['mystery_cricketer_name'] = mystery_cricketer['name'] # Reveal answer on loss

    return jsonify(response)

# Optional: Add an endpoint for autocomplete if you build custom JS for it
# @app.route('/autocomplete')
# def autocomplete():
#     query = request.args.get('q', '').lower()
#     suggestions = [name for name in cricketer_names if query in name.lower()][:10] # Limit suggestions
#     return jsonify(suggestions)

if __name__ == '__main__':
    app.run(debug=True) # debug=True is helpful for development, turn off for production