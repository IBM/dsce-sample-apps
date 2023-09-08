### instruction : Extract PII entities from the paragraph given

### Example :
#### Input - I withdrew $100 from the bank in New York from my phone (345) 123-7867. Regards, Raj Kumar
#### Output - $100: money,New York: location,(345) 123-7867: PhoneNumber,Raj Kumar: Person

### Test : 
#### Input Text - On March 30th, 2023, I noticed a charge of $1,000 on my credit card statement that I did not authorise. The transaction was made at a restaurant in New York. I am concerned about the security of my account and I would appreciate if you could investigate this matter promptly. Please contact me at my phone number (123)456-7890 I look forward to hear from you soon. Thanks Ravi


### Model - ibm/mpt-7b-instruct2

### Parameter - "parameters": {  "decoding_method": "greedy",  "max_new_tokens": 30,  "min_new_tokens": 0,  "stop_sequences": [],  "repetition_penalty": 1 }
