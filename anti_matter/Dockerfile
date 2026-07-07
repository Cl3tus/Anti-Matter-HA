ARG BUILD_FROM
FROM ${BUILD_FROM}

# DejaVu Sans Mono for the generated Matter label PNG — without it, Pillow silently
# falls back to a tiny fixed-size bitmap font and the layout math (tuned for a real
# scalable font) no longer lines up.
RUN apk add --no-cache font-dejavu

# Python deps
COPY app/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# App
WORKDIR /app
COPY app/ /app/
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
