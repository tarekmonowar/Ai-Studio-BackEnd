const postgresInterviewQuestions = [
  // Fundamentals
  "What is PostgreSQL?",
  "What type of database is PostgreSQL?",
  "What is the difference between SQL and PostgreSQL?",
  "Why is PostgreSQL called an object-relational database?",
  "What are the key features of PostgreSQL?",
  "PostgreSQL vs MySQL – what are the differences?",
  "When would you choose PostgreSQL over other databases?",

  // Schema & Tables
  "How do you create a database in PostgreSQL?",
  "How do you create a table in PostgreSQL?",
  "What is a primary key?",
  "What is a foreign key?",
  "How do constraints work in PostgreSQL?",
  "What are common constraints in PostgreSQL?",
  "What is the difference between VARCHAR and TEXT?",
  "What is SERIAL in PostgreSQL?",
  "What is a sequence and how is it used?",
  "How do you alter an existing table?",
  "How do you drop a column from a table?",
  "Difference between soft delete and hard delete",

  // CRUD Operations
  "How do you insert data into a table?",
  "How do you select data from a table?",
  "How do you update data in PostgreSQL?",
  "How do you delete data from PostgreSQL?",
  "Difference between DELETE and TRUNCATE",
  "What is RETURNING clause in PostgreSQL?",
  "How do you implement pagination using LIMIT and OFFSET?",

  // Joins & Relationships
  "What are joins in PostgreSQL?",
  "Explain INNER JOIN with example",
  "Explain LEFT JOIN with example",
  "Explain RIGHT JOIN with example",
  "Explain FULL OUTER JOIN",
  "What is a CROSS JOIN?",
  "How does PostgreSQL handle relationships?",
  "What is referential integrity?",

  // Indexing & Performance
  "What is an index in PostgreSQL?",
  "How do indexes improve performance?",
  "When can indexes hurt performance?",
  "What types of indexes does PostgreSQL support?",
  "What is a B-Tree index?",
  "What is a composite index?",
  "How do you analyze a slow SQL query?",
  "What is EXPLAIN and EXPLAIN ANALYZE?",
  "What is a sequential scan?",

  // Transactions & ACID
  "What is a transaction in PostgreSQL?",
  "Explain ACID properties",
  "How does PostgreSQL ensure atomicity?",
  "What are isolation levels?",
  "What isolation levels does PostgreSQL support?",
  "What is dirty read and does PostgreSQL allow it?",
  "What is serialization failure?",
  "How do you handle concurrent updates?",

  // Advanced Concepts
  "What is normalization and why is it important?",
  "Explain 1NF, 2NF, and 3NF",
  "What is denormalization and when should you use it?",
  "What is the N+1 query problem?",
  "How do you prevent the N+1 query problem?",
  "What is connection pooling?",
  "Why is connection pooling needed?",
  "What is read vs write optimization?",
  "How do you design schemas for scalability?",

  // ORM & Prisma
  "How do ORMs work internally?",
  "What are the advantages of using an ORM?",
  "What are the disadvantages of using an ORM?",
  "How does Prisma work with PostgreSQL?",
  "How does Prisma prevent SQL injection?",
  "What are migrations in Prisma?",
  "How do you handle migrations and rollbacks?",
  "ORM vs raw SQL – when to use which?",

  // Data Integrity & Reliability
  "How do you ensure data consistency in concurrent systems?",
  "What are database migrations?",
  "What is optimistic locking?",
  "What is pessimistic locking?",
  "How do you handle partial or inconsistent data?",
  "How do you debug production database issues?",
  "What are common PostgreSQL performance mistakes?",
];

export default postgresInterviewQuestions;
