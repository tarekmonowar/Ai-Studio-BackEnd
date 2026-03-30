const dockerInterviewQuestions = [
  // Core Concepts
  "What is Docker?",
  "Why do we use Docker?",
  "What problem does Docker solve?",
  "What does containerization mean?",
  "What is the difference between containerization and virtualization?",
  "How is Docker different from a Virtual Machine?",
  "What does it mean that Docker shares the host OS kernel?",
  "Can you run a Windows container on a Linux host? Why or why not?",
  "What are the advantages and disadvantages of Docker?",
  "What is Docker Engine?",

  // Images & Containers
  "What is a Docker image?",
  "What is a Docker container?",
  "What is the difference between an image and a container?",
  "What is a Dockerfile?",
  "Why are Docker images immutable?",
  "What happens when you run a Docker image?",
  "What is the CMD instruction in Dockerfile?",
  "What is the difference between CMD and RUN in Dockerfile?",
  "What is ENTRYPOINT?",
  "How do you build a Docker image?",

  // Docker Hub & Registry
  "What is Docker Hub?",
  "What is a Docker registry?",
  "How do you push an image to Docker Hub?",
  "What is image tagging and why is it required?",
  "What is the difference between docker pull and docker run?",

  // Volumes & Data Persistence
  "What are Docker volumes?",
  "Why do we need volumes in Docker?",
  "What problem do volumes solve?",
  "What is the difference between volumes and bind mounts?",
  "What is a named volume?",
  "What is an anonymous volume?",
  "When should you use bind mounts?",
  "When should you use volumes in production?",
  "Can volumes be defined in a Dockerfile?",
  "How do you remove unused volumes?",

  // Docker Compose
  "What is Docker Compose?",
  "Why is Docker Compose useful?",
  "What problem does Docker Compose solve?",
  "What is docker-compose.yml?",
  "How does Docker Compose handle networking?",
  "How do containers communicate in Docker Compose?",
  "What is service discovery in Docker Compose?",
  "Is Docker Compose used in production?",
  "Docker Compose vs Kubernetes – what is the difference?",

  // Networking
  "What is Docker networking?",
  "How does Docker networking work?",
  "How do containers communicate with each other?",
  "What is port mapping in Docker?",
  "What happens when you run docker run -p 5000:3000?",
  "Why does localhost inside a container not mean the host machine?",
  "What is host.docker.internal used for?",
  "What is a Docker bridge network?",
  "How do you create a custom Docker network?",
  "How do you inspect container IP addresses?",

  // Development Tools
  "What is a devcontainer?",
  "What problem does the Dev Container extension solve?",
  "What is a utility container?",
  "When would you use a utility container?",

  // Debugging & Commands
  "How do you debug a running Docker container?",
  "What does docker logs do?",
  "What does docker exec -it do?",
  "What does docker inspect show?",
  "What is docker ps vs docker ps -a?",
  "What does --rm flag do?",
  "What is the difference between attached and detached mode?",

  // Security
  "What are common Docker security concerns?",
  "How do you secure Docker containers?",
  "Why should containers run as non-root?",
  "What are Docker secrets?",
  "How do you scan Docker images for vulnerabilities?",

  // Orchestration
  "What is Docker Swarm?",
  "What problem does Docker Swarm solve?",
  "What are the key features of Docker Swarm?",
  "Docker Swarm vs Kubernetes – what are the differences?",
  "Why is Kubernetes preferred in large production systems?",

  // Architecture & Performance
  "What is a hypervisor?",
  "How is Docker more resource-efficient than VMs?",
  "What is horizontal scalability in Docker-based systems?",
  "What are the limitations of Docker?",
  "What are common Docker performance issues?",
  "How do you clean up unused Docker resources?",
  "What is docker system prune?",
];

export default dockerInterviewQuestions;
