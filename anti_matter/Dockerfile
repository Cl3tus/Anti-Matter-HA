ARG BUILD_FROM
FROM ${BUILD_FROM}

# Python deps
COPY app/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# App
WORKDIR /app
COPY app/ /app/
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
