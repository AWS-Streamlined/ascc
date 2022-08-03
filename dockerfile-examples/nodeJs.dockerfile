FROM public.ecr.aws/docker/library/node:16-bullseye-slim

WORKDIR /build

# Copy all the necessary files to build the SST application. Source file paths should be relative to the root of your repository
COPY tsconfig.json /build/
COPY sst.json /build/
COPY package.json /build/
COPY package-lock.json /build/
COPY services/ /build/services/
COPY stacks/ /build/stacks/

# Install required modules and run tests.
# Add any other command that should be run as part of the build here (code coverage, static analysis, etc.)
RUN npm install
RUN npm test

# This command will be run by the pipeline, and will initiate an SST build
CMD npm run build