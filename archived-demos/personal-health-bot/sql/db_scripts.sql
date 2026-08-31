-- DDL
CREATE TABLE patient_history (
  unique_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  metric_value FLOAT NOT NULL,
  min_value FLOAT,
  max_value FLOAT,
  report_date DATE NOT NULL,
  user_id INT NOT NULL
);

-- DML
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',14.6,14,18,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',43.6,42,52,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',4.9,4.7,6.1,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',6.1,4.8,10.8,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',320,150,450,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',50,33,73,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',36,13,52,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',8,0,10,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',5,0,5,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',1,0,2,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',109,80,100,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',27,27,32,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',33,32,36,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',14,11.5,14.5,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',8.5,7.5,11,'2022-01-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',3.5,0.45,4.5,'2022-01-16',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',12,14,18,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',43,42,52,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',5,4.7,6.1,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',6,4.8,10.8,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',300,150,450,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',40,33,73,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',20,13,52,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',2,0,10,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',1,0,5,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',2,0,2,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',88,80,100,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',30,27,32,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',33,32,36,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',12,11.5,14.5,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',10,7.5,11,'2022-04-20',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',5,0.45,4.5,'2022-04-20',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',13.3,14,18,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',45,42,52,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',5,4.7,6.1,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',5,4.8,10.8,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',400,150,450,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',40,33,73,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',35,13,52,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',3,0,10,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',2,0,5,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',2,0,2,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',65,80,100,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',34,27,32,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',30,32,36,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',12,11.5,14.5,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',8,7.5,11,'2022-06-01',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',4.8,0.45,4.5,'2022-06-01',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',13.3,14,18,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',40,42,52,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',4.5,4.7,6.1,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',7,4.8,10.8,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',440,150,450,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',51,33,73,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',31,13,52,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',3,0,10,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',3,0,5,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',3,0,2,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',80,80,100,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',23,27,32,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',33,32,36,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',14,11.5,14.5,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',10,7.5,11,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',4.6,0.45,4.5,'2022-07-24',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBS',100,70,140,'2022-07-24',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',12,14,18,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',40,42,52,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',4,4.7,6.1,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',8,4.8,10.8,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',410,150,450,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',34,33,73,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',23,13,52,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',1,0,10,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',1,0,5,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',1,0,2,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',89,80,100,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',30,27,32,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',34,32,36,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',12,11.5,14.5,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',8,7.5,11,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',4.7,0.45,4.5,'2022-08-16',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBS',150,70,140,'2022-08-16',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',11.6,14,18,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',39,42,52,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',5.2,4.7,6.1,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',5.6,4.8,10.8,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',310,150,450,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',45,33,73,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',32,13,52,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',4,0,10,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',6,0,5,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',1,0,2,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',94,80,100,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',29,27,32,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',33,32,36,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',13.2,11.5,14.5,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',9,7.5,11,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',5.1,0.45,4.5,'2022-11-03',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBS',160,70,140,'2022-11-03',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',12.5,14,18,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',41.7,42,52,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',4.9,4.7,6.1,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',8.3,4.8,10.8,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',360,150,450,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',44,33,73,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',22,13,52,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',5,0,10,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',2,0,5,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',0.4,0,2,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',87,80,100,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',32,27,32,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',34,32,36,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',12,11.5,14.5,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',10,7.5,11,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',4.6,0.45,4.5,'2022-12-22',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBS',145,70,140,'2022-12-22',10001);

INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hemoglobin',13.1,14,18,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Hematocrit',42.2,42,52,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBC',4.8,4.7,6.1,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','WBC',10,4.8,10.8,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Platelets',210,150,450,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Neutrophil',51,33,73,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Lymphocyte',41,13,52,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Monocyte',3,0,10,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Eosinophil',2,0,5,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Basophil',1,0,2,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Volume',82,80,100,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hemoglobin',28,27,32,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Cell Hb Conc',32,32,36,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Red Cell Dist Width',12.2,11.5,14.5,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','Mean Platelet Volume',8.4,7.5,11,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','TSH',4.4,0.45,4.5,'2023-02-21',10001);
INSERT INTO patient_history (name, metric_name, metric_value, min_value, max_value, report_date, user_id) VALUES ('John D','RBS',141,70,140,'2023-02-21',10001);
