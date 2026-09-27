# Bhoomi Drishti

Land Acquisition Delay Intelligence dashboard with the integrated `land_model` ML service.

## What changed

- `app.js` now requests every project's prediction from `POST /api/predict`.
- `api/predict.py` loads the serialized model from `land_model.zip`.
- Risk score, delay probability, tier, model feature weights, actions and timeline are returned to the dashboard.
- `vercel.json` includes `land_model.zip` in the Python serverless function.
- `run_model_api.py` starts the API locally on port 8000.

## Run locally

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Start the model API:

```bash
python run_model_api.py
```

Then open the dashboard. When the page is opened from localhost or directly as a file, `app.js` automatically uses:

```
http://127.0.0.1:8000
```

Check the model:

```
http://127.0.0.1:8000/api/health
```

For a separately hosted frontend/API, set `window.BHOOMI_API_URL` before loading `app.js`.

## Deployment

The repository is structured for Vercel: the static dashboard remains at the root and `api/predict.py` becomes the prediction endpoint. `land_model.zip` is explicitly included with the function.

The API uses the model's `feature_names_in_` when available. This is important because it lets a scikit-learn pipeline receive the trained feature names instead of blindly assuming column order.
