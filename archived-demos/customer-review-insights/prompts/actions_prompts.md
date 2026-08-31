### instruction : For each of the unhappy customer's complaint below find out one of the next best offer for them from the list below : Voucher, Free Upgrade, On-demand pickup location, Premium features

### Example :
#### Input - Customer service is horrible. I reserved through on-line which did not indicate/state I had to provide proof of insurance during pickup. The manager denied the reservation and after long and rude argument he finally gave in.
#### Output - Voucher

#### Input - Having knowledgeable personnel is very important
#### Output - Voucher

#### Input - I do not  understand why I have to pay additional fee if vehicle is returned without a full tank.
#### Output - Premium features

#### Input - States have different rules and regulations pertaining to speed, radar detectors, even when light should be on.  Customer services reps should have a handout or be knowledgeable of a particular state's laws.
#### Output - Premium features

#### Input - They did not have the car I wanted.  upgraded me to a car I did not like and did not want.
#### Output - Free Upgrade

#### Input - Please lower the prices.
#### Output - Free Upgrade

#### Input - You need more staff to accommodate travelers who are in a hurry. Specifically, cut down the wait time to either retrieve or turn in a rental car.
#### Output - On-demand pickup location

#### Input - It took us almost three hours just to get a car! It was absurd.
#### Output - On-demand pickup location

### Test : 
#### Input Text - Please stop increasing the prices.


### Model - google/flan-t5-xxl

### Parameter - "parameters": {  "decoding_method": "greedy",  "max_new_tokens": 50,  "min_new_tokens": 0}
