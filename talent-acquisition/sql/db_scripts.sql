-- Create resumes table
CREATE TABLE resumes (
  id int primary key auto_increment,
  Name VARCHAR(255),
  Role VARCHAR(255),
  Email VARCHAR(255),
  Phone VARCHAR(20),
  LinkedIn VARCHAR(255),
  Github VARCHAR(255),
  Location VARCHAR(255),
  Degree VARCHAR(255),
  College VARCHAR(255),
  Graduation DATE,
  Skills VARCHAR(255),
  Work_Experience Text,
  Summary Text
);

-- Insert scripts
INSERT INTO resumes (Name, Role, Email, Phone, LinkedIn, Github, Location, Degree, College, Graduation, Skills, Work_Experience, Summary) VALUES 
('Je We Kini', 'Entry-Level Web Developer', 'jewkin@email.com', '(123) 456-7890', 'linkedin.com/in/jew-kin', 'github.com/jwk-codes', 'Chicago, IL', 'Certified Web Developer', 'Maxim Online College', '2021-07-01', 'HTML; CSS; JavaScript; Python; REST APIs; Node.js; Bootstrap; React.js', 'Company: TeamXchange
Role: Web Developer Intern
Date: June 2021 - present

Company: Gemini Messenger
Role: Creator
Date:

Company: Food Frenzy
Role: Creator
Date:
', 'Je We Kini is a web developer with experience in web creative design and development, product development, technical support, customer service, and mobile-first applications. He has worked on projects such as Gemini Messenger and Food Frenzy, where he used technologies such as React.js, Python, Redux, RESTful APIs, HTML, CSS, Bootstrap, and Vanilla JS. He has also worked as a web developer intern at TeamXchange, where he assisted in product development and enhancements, provided technical support, and created and deployed mobile-first applications. He has a certification in web development from Maxim Online College.');

INSERT INTO resumes (Name, Role, Email, Phone, LinkedIn, Github, Location, Degree, College, Graduation, Skills, Work_Experience, Summary) VALUES 
('Gary Rosenburg', 'Web Developer, Web Designer', 'garyrosen@email.com', '(123) 456-7890', 'NOT FOUND', 'NOT FOUND', 'New York, NY', 'B.S. Computer Science', 'New York College', '2020-06-01', 'JavaScript HTML CSS React.js Node.js Python PHP', 'Company: Geometrics
Role: Web Developer
Date: June 2021 - present

Company: New York College
Role: Web Designer
Date: September 2017 - June 2020
', 'Gary Rosenburg is a web developer and web designer with experience in responsive design, OOP web development, and WordPress training. He has worked at Geometrics and has a degree in Computer Science from New York College. He is seeking a new opportunity to grow his skills and facilitate the empowerment and vocalization of marginalized communities. His skills include JavaScript, HTML/CSS, PHP, and React.js. He has worked on projects such as a store locator and has experience with API calls and plotly.');

INSERT INTO resumes (Name, Role, Email, Phone, LinkedIn, Github, Location, Degree, College, Graduation, Skills, Work_Experience, Summary) VALUES 
('John Clairmont', 'Senior Web Developer', 'jclair@email.com', '(123) 456-7890', 'NOT FOUND', 'NOT FOUND', 'Tampa, FL', 'B.S. Computer Science', 'University of Florida', '2016-06-01', 'Python; JavaScript; HTML; CSS; Java; PHP;', 'Company: SquareRoot
Role: Senior Web Developer
Date: January 2020 - current

Company: Florida State University
Role: Web Designer
Date: April 2017 - January 2021

Company: Seeme.com
Role: Front-End Developer Intern
Date: June 2016 - April 2017
', 'John Clairmont is a senior web developer with experience in leading and managing teams, developing customer-specific design frameworks, and collaborating with sales teams to create marketing designs. He has worked at SquareRoot, where he oversaw the concept mock-up and wireframe design, and at Florida State University, where he created and assisted with the development of official university-sponsored websites. He has also worked as a front-end developer intern at Seeme.com, where he translated designs and wireframes into high-quality code and provided input to leaders about the future development of new features. He has a Bachelor of Science in Computer Science from the University of Florida.');

INSERT INTO resumes (Name, Role, Email, Phone, LinkedIn, Github, Location, Degree, College, Graduation, Skills, Work_Experience, Summary) VALUES 
('Stephanie Smith', 'Web Developer', 'steph@email.com', '(123) 456-7890', 'NOT FOUND', 'NOT FOUND', 'Pittsburgh, PA', 'B.S. Computer Science', 'University of Pittsburgh', '2023-10-01', 'JavaScript (Angular); HTML/ CSS; Python (Django); SQL (PostgreSQL, Oracle);', 'Company: University of Pittsburgh
Role: Technical support engineer
Date: January 2018 - current

Company: Pittsburgh Computer Science Institute
Role: Research Assistant
Date: April 2015 - January 2018
', 'Stephanie Smith is a web developer with experience in natural language processing and building web apps for non-technical users. She has worked at the University of Pittsburgh Help Desk and Pittsburgh Computer Science Institute. She is seeking a full-time position where she can utilize her skills to further the mission of CourseX. She has a Bachelor of Science in Computer Science from the University of Pittsburgh and has skills in JavaScript, HTML/CSS, Python, SQL, and REST APIs. She has worked on projects such as ReviewMe, an interactive web app for streamlining the process of literature review for researchers in the University of Pittsburgh School of Architecture. She has also implemented a ticketing system to streamline the process of responding to issues at the University of Pittsburgh Help Desk.');

INSERT INTO resumes (Name, Role, Email, Phone, LinkedIn, Github, Location, Degree, College, Graduation, Skills, Work_Experience, Summary) VALUES 
('Jeremy Grey', 'Senior Software Developer', 'jeremy.grey21@email.com', '(123) 456-7890', 'NOT FOUND', 'NOT FOUND', 'Riverside, CA', 'Bachelor of Science in Computer Science', 'Georgia Tech', '2012-04-01', 'Python (Django), SQL (PostgreSQL, MySQL), Cloud (GCP, AWS), JavaScript (ES6, React, Redux, Node.js), Typescript, HTML/CSS, CI/CD', 'Company: Nero.pay
Role: Software Developer
Date: January 2017 - current

Company: Vision Healthcare
Role: Front End Developer
Date: January 2014 - December 2016

Company: Popular Play
Role: Developer
Date: NOT FOUND
', 'Jeremy Grey is a senior software developer with experience in building applications for industries with stringent technical requirements. He has worked at Nero.pay and Vision Healthcare, where he led the migration from AWS to GCP, worked closely with the product team to re-configure the processing of invoices, and mentored junior front-end developers. He has skills in Python, SQL, cloud computing, JavaScript, and Typescript. He has also contributed to in-house UI libraries, created web app MVPs, and added new features to meditation apps. He has a Bachelor of Science in Computer Science from Georgia Tech.');
