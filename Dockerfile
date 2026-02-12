# Stage 1: build React frontend
FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/ frontend/
RUN npm --prefix frontend ci && npm --prefix frontend run build

# Stage 2: Python backend + built frontend
FROM python:3.11-slim
WORKDIR /app
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist
RUN pip install -r backend/requirements.txt
EXPOSE 8000
CMD ["python", "backend/main.py"]
