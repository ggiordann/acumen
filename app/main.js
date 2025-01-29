$(document).ready(function() {
    $("#fileInput").change(function (event) {
        const file = event.target.file[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $("#preview").attr("src", e.target.result).show();
            }
            reader.readAsDataUrl(file);
        }
    })
})