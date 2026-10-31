FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# Fixed cache location, so build time and runtime agree on where the model lives.
ENV HF_HOME=/opt/hf-cache

# CPU-only torch first, so sentence-transformers doesn't pull the multi-GB CUDA build.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image. This layer sits above the app code,
# so code changes don't re-download it.
ARG HF_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ENV HF_EMBEDDING_MODEL=${HF_EMBEDDING_MODEL}
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${HF_EMBEDDING_MODEL}')"

# The running container never needs the Hub for model files.
ENV HF_HUB_OFFLINE=1

COPY app ./app

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}