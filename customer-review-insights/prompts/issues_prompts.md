### instruction : The following paragraph is a customer review for a car rental service. The complaint is about one or many of these issues: high pricing, lack of right size car, inadequate staff knowledge, customer Service issue, bad staff attitude, delays, lack of information, car equipment issue\n\nRead the following paragraph and determine which all issues the complaint is about. One complain can have multiple issues. Extract all the possible issues from the list of issues mentioned above.

### Example :
#### Input - long lines waiting for the rental pick
#### Output - delays

#### Input - They did not have the car I wanted.  upgraded me to a car I did not like and did not want.
#### Output - lack of right size car

#### Input - price too high and location off premise too far.
#### Output - high pricing

#### Input - It would be nice if they included maps to the airport drop off with the car, last time we got lost returning the car and almost missed the flight.  There was nothing on the exit that indicated rental returns.  Actually the one I really liked, was when we
#### Output - lack of information

#### Input - friendly, but could not making any decisions on own, sales reps are not knowledgeable
#### Output - inadequate staff knowledge

#### Input - I would like the personnel to pretend they care about customer, at least.
#### Output - customer service issue, bad staff attitude

#### Input - The company was overwhelmed by the number of customers verse the number of available agents and they were not articulating their situation to the customers well enough. I think we waited for almost 3 hours just to get a rental car. It was ridiculous.
#### Output - customer Service issue,inadequate staff knowledge, delay

#### Input - Had problems with windshield wipers that affected usability.  Problem was not solved.  Customer service was NOT helpful. Because of franchising, I was not able to get help from an office other than the one I rented from.  I had driven 60 miles from that location and there was another location 2 miles from where I was staying.  Price of Wiper is high
#### Output - car equipment issue, customer service issue,high pricing

#### Input - They were too pushy in trying to sell insurance.It took us almost three hours just to get a car! It was absurd.
#### Output - staff attitude, delay

#### Input - It was absolutely ATROCIOUS! My wife and I were in a foreign country  when we realized that our car had an expired license plate and expired proof of insurance!
#### Output - expired paperworks

#### Input - Most windows were closed.
#### Output - car equipment issue

### Test : 
#### Input Text - Please stop increasing the prices.


### Model - google/flan-t5-xxl

### Parameter - "parameters": {  "decoding_method": "greedy",  "max_new_tokens": 50,  "min_new_tokens": 0}
