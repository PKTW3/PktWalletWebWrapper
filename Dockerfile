FROM debian:bullseye
RUN apt-get update && apt-get install -y g++ apt-utils git wget curl && wget https://go.dev/dl/go1.17.7.linux-amd64.tar.gz && rm -rf /usr/local/go && tar -C /usr/local -xzf go1.17.7.linux-amd64.tar.gz && export PATH=$PATH:/usr/local/go/bin && git clone https://github.com/pkt-cash/pktd && cd pktd && ./do && curl -fsSL https://deb.nodesource.com/setup_14.x | bash && apt-get install -y nodejs
ADD ./webwallet /srv/webwallet
ADD ./client /srv/client
RUN cd /srv/webwallet && npm install && cd ~