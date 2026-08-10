### instruction : Classify review as positive or negative

### Example :
#### Input - Customer service was friendly and helpful.
#### Output - positive

#### Input - Customer service was good at MSP airport and the process was very fast.  From getting off of the plane to leaving with my rental car was less than 45 minutes.
#### Output - positive

#### Input - I do not  understand why I have to pay additional fee if vehicle is returned without a full tank.
#### Output - negative

#### Input - Based on the customer service personnel I encountered most recently, I would say it is vastly preferable for the personnel to be able to at least pretend to care whether the customer ever actually receives a car rental that was reserved months in advance.
#### Output - negative

### Test : 
#### Input Text - Customer service went out of their way to provide a car that would fit our needs. Excellent.


### Model - google/flan-ul2

### Parameter - "parameters": {  "decoding_method": "greedy",  "max_new_tokens": 30,  "min_new_tokens": 0}
