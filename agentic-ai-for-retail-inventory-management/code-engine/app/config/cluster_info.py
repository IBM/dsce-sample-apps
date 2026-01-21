
# ### Customer Cluster Narratives
# customer_cluster_explanations = {
#     0: """This cluster is small (11%) and entirely made up of Silver-segment customers identifying as “Other.” They are concentrated in New York, Georgia, and Missouri, with mostly low-to-medium income levels. Their loyalty is fragmented across tiers, and their purchase frequency is moderate with average spending around 2,200. They buy about five items per order, usually spending \~270 per order. Engagement is slightly above baseline on email but fulfillment is below average, and they rarely use discounts or respond to campaigns. A handful of top customers and SKUs drive the majority of sales in this group.""", 

#     1: """This is the largest group (26%), consisting entirely of women in Silver and Gold segments. Income distribution is balanced across low, medium, and high levels. They are split across loyalty tiers, with a high share of Platinum members. Their purchase frequency is steady, and their lifetime spend is slightly above Cluster 0. They are highly engaged on email, and fulfillment is on par with the base. Despite strong engagement, discount usage and campaign response remain negligible. Their purchasing is dominated by a few high-value SKUs, especially in apparel and accessories.""",

#     2: """This small cluster (10%) includes Gold-segment customers identifying as “Other.” They are skewed toward high-income levels but include a mix of all tiers. They shop less frequently but order more items per basket, suggesting a preference for bulk buying. Average order value is healthy at \~274, though lifetime spend is slightly lower than other groups. Email engagement is weak, and fulfillment is below average. They rarely engage in promotions, showing low responsiveness to campaigns. Their spend is concentrated on a narrow set of SKUs.""",

#     3: """Representing 20% of customers, this cluster is entirely Platinum-segment, with a mix of “Other” and female genders. Income is balanced across levels, and loyalty is spread across all tiers. They purchase frequently with strong spend per customer and above-average lifetime value (\~2,700). Their baskets average around 5-6 items per order. Engagement is high (65% email open rate), though fulfillment is slightly below base. This group shows minimal discount sensitivity, with only occasional campaign activity. They generate strong value through repeated purchases across premium SKUs.""",

#     4: """This cluster (22%) is entirely male, with a split between Silver and Gold segments. They skew toward low and medium income, but with significant Platinum loyalty representation. They purchase fairly often, with a moderate order size and average order value of \~255. Their lifetime spend is \~2,400, but engagement is weak at only 42%, the lowest across clusters. Despite low engagement, fulfillment is above average, and returns are minimal. A small fraction uses discounts, and a few campaigns reach them successfully. High-value SKUs in grocery and household categories dominate their spending.""",

#     5: """This cluster (11%) consists of male Platinum-segment customers, mostly medium-to-low income. They purchase less frequently but maintain strong lifetime spend (\~2,600) with consistent basket sizes. Order values average \~261, and their engagement rate is the highest of all clusters (68%). Fulfillment is strong, and returns are very low. They show limited discount usage and campaign interaction, yet demonstrate high propensity to repurchase. Their sales are concentrated in a few premium SKUs, making them a high-value but narrowly focused group."""
# }


customer_cluster_explanations= {
  0: "Bulk Buyers",
  1: "Engaged Shoppers",
  2: "Everyday Shoppers",
  3: "Premium Shoppers",
  4: "Window Shoppers",
  5: "New Explorers"
}


### SKU Cluster Narratives
sku_cluster_explanations = {
  0: "Core Essentials",
  1: "Fashion Staples",
  2: "Book Niche",
  3: "Tech Goods",
  4: "Value Groceries",
  5: "Home Premiums"
}


# {
#     0: """This is the largest SKU group (48%), dominated by Books and Grocery items, with some Electronics and Home products. Suppliers are mostly based in Wyoming and South Dakota. Prices average around 102, with healthy stock levels and reorder thresholds near 65 units. Sales velocity is steady, with average sales value around 277. Supplier reliability is low at 38%, though fulfillment is slightly above base. Promotions are minimal, and campaign response is negligible. Sales are driven by a few star SKUs such as SKU0097 and SKU0082, largely purchased by high-value customers like C0181 and C0135.""",

#     1: """This group (28%) consists almost entirely of Clothing SKUs, with suppliers spread across Vermont, Iowa, and Nevada. Average price is slightly lower at 98, and stock levels are high, averaging \~264 units. Reorder thresholds hover around 65, with moderate sales velocity and average sales value of \~254. Supplier reliability is slightly better than Cluster 0, at 42%. Fulfillment is on par with base, while discount use and campaign success remain negligible. Sales concentration is high around fashion SKUs such as SKU0091 and SKU0015, purchased frequently by customers like C0130 and C0185.""",

#     2: """This is a very small cluster (5%) made up entirely of Books. Supplier coverage is fragmented, with Iowa being the largest source. Prices are slightly higher at \~106, and stock levels vary widely. Sales velocity is steady, and order values average \~259. Supplier reliability is the weakest at 34%, and fulfillment lags behind base at only 47%. Promotions are rare but slightly more frequent than other clusters, with some campaign activity at 5%. A few SKUs, such as SKU0046, dominate sales, especially through customers like C0089 and C0129.""",

#     3: """This cluster (7%) is composed solely of Electronics. Suppliers are concentrated in Iowa and Connecticut. SKUs here are lower priced (\~88 on average) but have very high stock levels (\~347 units on hand). Reorder thresholds are higher than other groups (\~73), reflecting faster-moving goods. Supplier reliability is 40%, with fulfillment the weakest at 44%. Promotions and campaigns are nonexistent. Sales are led by high-value electronics SKUs such as SKU0018 and SKU0042, purchased by customers like C0198 and C0014.""",

#     4: """This group (6%) is a mix of Grocery and Home SKUs. Suppliers are mainly in New York and Kansas. Prices are the lowest across clusters at \~83, with moderate stock and reorder thresholds around 68. Sales velocity is steady, and average sales value is \~240. Supplier reliability is average at 39%, but fulfillment is the strongest of all clusters at 65%. Discounts and campaigns are more visible here, with 14% campaign activity and slightly higher discounting. Top SKUs include SKU0036 and SKU0087, bought heavily by customers like C0185 and C0158.""",

#     5: """This small cluster (6%) consists entirely of Home products, with suppliers spread across Oregon, Alabama, and Wyoming. Prices vary widely, averaging \~92. Stock is relatively low (\~126 units), with reorder thresholds near 58. Sales velocity is steady, and order values are the highest across SKU clusters at \~280. Supplier reliability is the weakest at 31%, and fulfillment is the lowest at 39%. Promotions are absent, and campaign response is nonexistent. A few large-ticket SKUs such as SKU0010 and SKU0012 dominate sales, especially with customers like C0014 and C0024."""
# }
