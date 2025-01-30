let base64Data = null;

$(document).ready(function() {
  // handle file selection
  $("#fileInput").change(function(event) {
    const file = event.target.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        // show image preview
        $("#preview").attr("src", e.target.result).show();

        // store base64 data for later use
        base64Data = e.target.result.split(",")[1];
      };
      reader.readAsDataURL(file);
    }
  });

  // handle analyze button click
  $("#analyzeBtn").click(function() {
    // if we have a valid image's base64 data
    //no ajax :brokenheart:
    if (base64Data) {
      fetch("http://localhost:5500/app/analyze", { //http://localhost:5500/analyze
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ imageData: base64Data })
      })
      .then(res => res.json())
      .then(data => {
        // display the analysis result in the p element
        $("#analysisOutput").text("analysis: " + data.response); // adi format some stuff here to make it look better
      })
      .catch(err => {
        console.error("error calling analyze endpoint:", err);
        $("#analysisOutput").text("an error occurred during analysis");
      });
    } else {
      // if no file is selected
      $("#analysisOutput").text("please select an image first");
    }
  });
});