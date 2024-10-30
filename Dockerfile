FROM python:3.11

WORKDIR /app

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt 

COPY ./ /app

CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8080"] 