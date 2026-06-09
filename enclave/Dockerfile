# Mizan Enclave Image
# Built into an EIF (Enclave Image File) using:
#   nitro-cli build-enclave --docker-uri mizan-enclave --output-file mizan.eif
#
# IMPORTANT: Must build FROM the working base image (mizan-original:test on EC2).
# python:3.11-slim-trixie from Docker Hub crashes on Nitro kernel 4.14.256.
# The original image (8f4172b0d5c8, mizan-original:test) is the only confirmed
# working base. Build on EC2 with:
#   sudo docker build -t mizan-enclave:latest -f Dockerfile.ec2 .

FROM mizan-original:test

WORKDIR /app

# Copy enclave server (deps already installed in base image)
COPY server.py .

# Enclave has no network access, no SSH, no interactive shell
# Communication is vsock only
ENTRYPOINT ["/usr/local/bin/python3", "/app/server.py"]
