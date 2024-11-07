FROM python:3.11

WORKDIR /app

COPY ./requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt 

COPY ./ /app

CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8080"]  


# docker build -t xmes-test:1.0 .  
# docker run --name xmes-test -d -p 8080:8080 xmes-test:1.0  