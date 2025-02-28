let base64Data = "";
let previewImages = [];
let currentImageIndex = 0;

$(document).ready(function() {
  if ($("#google-font").length === 0) {
    $("<link id='google-font' rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap'>").appendTo("head");
  }

  if ($("#spinner-style").length === 0) {
    $("<style id='spinner-style'>")
      .prop("type", "text/css")
      .html(`
        .spinner {
          border: 10px solid #f3f3f3; 
          border-top: 10px solid #00ff9d; 
          border-radius: 50%;
          width: 80px;
          height: 80px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `)
      .appendTo("head");
  }

  $("#fileInput").change(function(event) {
    base64Data = "";
    previewImages = [];
    $("#preview-container").empty();

    const files = event.target.files;
    if (files.length) {
      const readFilePromises = Array.from(files).map((file, index) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = function(e) {
            $("#preview-container").append(`<img src="${e.target.result}" data-index="${index}" class="preview-image" />`);
            previewImages.push(e.target.result.split(",")[1]);
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });


      Promise.all(readFilePromises)
        .then(() => {
          base64Data = previewImages.length > 0 ? previewImages[0] : '';
          let formData = new FormData();
          for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
          }
          return fetch("http://localhost:5500/upload", {
            method: "POST",
            body: formData
          });
        })
        .then(response => response.json())
        .then(data => {
          console.log("Files uploaded successfully:", data);
        })
        .catch(err => {
          console.error("Error reading files or uploading:", err);
        });
    }
  });


  $("#preview-container").on("click", "img.preview-image", function() {
    currentImageIndex = parseInt($(this).attr("data-index"));
    openLightbox(currentImageIndex);
  });

  $("#lightbox-close").click(function() {
    $("#lightbox").hide();
  });

  $("#lightbox-prev").click(function() {
    currentImageIndex = (currentImageIndex > 0) ? currentImageIndex - 1 : previewImages.length - 1;
    updateLightboxImage(currentImageIndex);
  });

  $("#lightbox-next").click(function() {
    currentImageIndex = (currentImageIndex < previewImages.length - 1) ? currentImageIndex + 1 : 0;
    updateLightboxImage(currentImageIndex);
  });

  function openLightbox(index) {
    updateLightboxImage(index);
    $("#lightbox").css("display", "flex"); // force display as flex to vertically center
  }

  function updateLightboxImage(index) {
    const src = "data:image/jpeg;base64," + previewImages[index];
    $("#lightbox-img").attr("src", src);
  }

  $("#analyzeBtn").click(function() {
    const platforms = $("input[name='platform']:checked").map(function() {
      return $(this).val();
    }).get();
    
    if (!base64Data) {
      $("#analysisOutput").text("Please upload an image and select a platform first.");
      return;
    }
    
    if (platforms.length === 0) {
      $("#analysisOutput").text("Please select a platform first.");
      return;
    }

    const loadingOverlay = $(`
      <div id="loadingOverlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 36px;
        font-family: 'Roboto', sans-serif;
        font-weight: 700;
        letter-spacing: -0.5px;
      ">
        <div style="text-align: center;">
         <div style="
          background: linear-gradient(120deg, #bfffea, #00ff9d); 
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: pulse 2s infinite ease-in-out;
         ">Analysing</div>
         <style>
           @keyframes pulse {
           0% { opacity: 0.8; }
           50% { opacity: 1; }
           100% { opacity: 0.8; }
           }
         </style>
         <div class="spinner" style="
          margin: 36px auto 0;
          display: block;
         "></div>
        </div>
      </div>
    `);
    $("body").append(loadingOverlay);

    let pending = platforms.length;
    function checkOverlay() {
      pending--;
      if (pending <= 0) {
        $("#loadingOverlay").remove();
      }
    }

    if (platforms.includes("facebook")) {
      fetch("http://localhost:5500/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").text("Facebook Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          fetch("http://localhost:5500/post-facebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adData)
          })
          .then(postRes => postRes.json())
          .then(postData => {
            $("#analysisOutput").append("\nFacebook Post: " + JSON.stringify(postData));
          })
          .catch(err => {
            console.error("Error posting to Facebook:", err);
            $("#analysisOutput").append("\nError posting to Facebook.");
          })
          .finally(() => {
            checkOverlay();
          });
        } catch (e) {
          console.error("Error parsing Facebook AI output:", e);
          $("#analysisOutput").append("\nError parsing Facebook AI output.");
          checkOverlay();
        }
      })
      .catch(err => {
        console.error("Error calling analyze endpoint:", err);
        $("#analysisOutput").text("An error occurred during Facebook analysis.");
        checkOverlay();
      });
    }

    if (platforms.includes("ebay")) {
      fetch("http://localhost:5500/analyze-ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        $("#analysisOutput").append("\neBay Analysis result: " + data.response);
        try {
          const adData = JSON.parse(data.response);
          fetch("http://localhost:5500/post-ebay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adData)
          })
          .then(postRes => postRes.json())
          .then(postData => {
            $("#analysisOutput").append("\neBay Post: " + JSON.stringify(postData));
          })
          .catch(err => {
            console.error("Error posting to eBay:", err);
            $("#analysisOutput").append("\nError posting to eBay.");
          })
          .finally(() => {
            checkOverlay();
          });
        } catch (e) {
          console.error("Error parsing eBay AI output:", e);
          $("#analysisOutput").append("\nError parsing eBay AI output.");
          checkOverlay();
        }
      })
      .catch(err => {
        console.error("Error calling analyze-ebay endpoint:", err);
        $("#analysisOutput").append("\nAn error occurred during eBay analysis.");
        checkOverlay();
      });
    }
  });

  $("#connectFB").click(function() {
    fetch("http://localhost:5500/run-fb-login")
      .then(response => response.text())
      .then(data => {
        console.log("fb_login.spec.js output:", data);
        alert("Authentication executed successfully.");
      })
      .catch(err => {
        console.error("Error executing fb_login.spec.js:", err);
        alert("Error executing fb_login.spec.js.");
      });
  });

  $("#connectEB").click(function() {
    fetch("http://localhost:5500/run-ebay-login")
      .then(response => response.text())
      .then(data => {
        console.log("ebay_login.spec.js output:", data);
        alert("Authentication executed successfully.");
      })
      .catch(err => {
        console.error("Error executing ebay_login.spec.js:", err);
        alert("Error executing ebay_login.spec.js.");
      });
  });
});