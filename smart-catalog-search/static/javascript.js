let chat_ctx = [];

// Add click event for source modal
function fnViewSource() {
  document.getElementById("source-modal").open = true;
}

function search_image(filename) {
  document.getElementById("my-lightbox").open = false;

  document.getElementById(
    "search-results"
  ).innerHTML = `<cds-inline-loading class="cds-theme-zone-white search-spinner" status="active">Fetching results from our catalog...
      please wait</cds-inline-loading>`;

  document.getElementById("bg-image").hidden = true;

  fetch("/find?filename=" + filename, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(
    async (res) => {
      let respJson = await res.json();
      if (respJson && respJson.products) {
        let { products } = respJson;

        if (!Array.isArray(products)) {
          document.getElementById(
            "search-results"
          ).innerHTML = `<cds-inline-loading class="cds-theme-zone-white search-spinner" status="error">Some error occured while searching products. <a href="/" style="color: #0E61FE;">Go back to Home page</a></cds-inline-loading>`;
          return;
        }

        let innerhtml = `<br/><b> <a href="/" style="color: #0E61FE;">Home</a> / Matching results (${products.length})</b><div class="product-group">`;
        products.forEach((product) => {
          const {
            image_url,
            details: { title, price, productid },
          } = product;
          producthtml = `<div id="div-card" title="${title}">
            <img src="${image_url}" alt="image" class="image-tag">
            <p class="product-desc">${title}</p>
            <p class="product-amt">${price}</p>
            <p class="product-id">Product ID: ${productid}</p>
          </div>`;
          innerhtml += producthtml;
        });
        document.getElementById("search-results").innerHTML =
          innerhtml + "</div>";
        // document.getElementById("bg-image").hidden = true;
        return;
      }
    },
    (err) => {
      console.log("Error while searching: ", err);
      document.getElementById("search-results").innerHTML =
        "Some error occured while searching.";
    }
  );
}

function clickToSearch() {
  document.getElementById("my-lightbox").open = true;
}
