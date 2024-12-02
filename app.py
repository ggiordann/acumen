# Author -> Avratanu Biswas 
# Youtube video ->
# Blog -> 

import streamlit as st
import st_static_export as sse
import base64
from openai import OpenAI

static_html = sse.StreamlitStaticExport()

# Function to encode the image to base64
def encode_image(image_file):
    return base64.b64encode(image_file.getvalue()).decode("utf-8")


st.set_page_config(page_title="Acumen", layout="centered", initial_sidebar_state="collapsed", page_icon=None)
# st.query_params is not callable, remove or replace with correct usage if needed
# Streamlit page setup
st.title("Acumen")


# Retrieve the OpenAI API Key from Streamlit secrets
api_key = st.secrets["OPENAI_API_KEY"]

# Initialize the OpenAI client with the API key
client = OpenAI(api_key=api_key)

# File uploader allows user to add their own image
uploaded_file = st.file_uploader("Upload an image", type=["jpg", "png", "jpeg"])

if uploaded_file:
    # Display the uploaded image
    with st.expander("Image", expanded = True):
        st.image(uploaded_file, caption=uploaded_file.name, use_container_width=True)

# Toggle for showing additional details input
show_details = st.toggle("Add details about the image", value=False)

if show_details:
    # Text input for additional details about the image, shown only if toggle is True
    additional_details = st.text_area(
        "Add any additional details or context about the image here:",
        disabled=not show_details
    )

currency = st.selectbox(
    "What currency do you wish to sell your item in?",
    ("USD", "AUD", "GBP", "EUR", "CAD")
)

condition = st.selectbox(
    "What is the condition of your item?",
    ("For Parts", "Refurbished", "Acceptable", "Good", "Very Good", "Like New", "Brand New"),
)

# Use st.multiselect for multiple selectable options
platforms = st.multiselect(
    'Select the platforms you wish to use:',
    ['Facebook Marketplace', 'Depop', 'Gumtree', 'StockX']
)


# add to prompt

# Button to trigger the analysis
analyze_button = st.button("Generate Description and Estimate Price", type="secondary")


realplatforms = ""
for i in range(len(realplatforms)):
    realplatforms += platforms[i] + " "

# Check if an image has been uploaded, if the API key is available, and if the button has been pressed
if uploaded_file is not None and api_key and analyze_button:

    with st.spinner("Analysing the image ..."):
        # Encode the image
        base64_image = encode_image(uploaded_file)
    
        # Optimized prompt for additional clarity and detail
        prompt_text = (
            "Default: Based on the uploaded image, create an estimated price in " + currency + "and generate a description for an advertisement for " + realplatforms +
            "Take the item's condition into account. It is in" + condition + "condition and adjust the price estimate and description accordingly. "
            "Provide a clear, concise, and attractive description that highlights the key features of the item and appeals to potential buyers."
        )
    
        if show_details and additional_details:
            prompt_text += (
                f"\n\nAdditional Context Provided by the User:\n{additional_details}"
            )
    
        # Create the payload for the completion request
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    },
                ],
            }
        ]
    
        # Make the request to the OpenAI API
        try:
            # Without Stream
            
            # response = client.chat.completions.create(
            #     model="gpt-4-vision-preview", messages=messages, max_tokens=500, stream=False
            # )
    
            # Stream the response
            full_response = ""
            message_placeholder = st.empty()
            for completion in client.chat.completions.create(
                model="gpt-4o", messages=messages, 
                max_tokens=1200, stream=True
            ):
                # Check if there is content to display
                if completion.choices[0].delta.content is not None:
                    full_response += completion.choices[0].delta.content
                    message_placeholder.markdown(full_response + "▌")
            # Final update to placeholder after the stream ends
            message_placeholder.markdown(full_response)
    
            # Display the response in the app
            # st.write(response.choices[0].message.content)
        except Exception as e:
            st.error(f"An error occurred: {e}")
else:
    # Warnings for user action required
    if not uploaded_file and analyze_button:
        st.warning("Please upload an image.")
    if not api_key:
        st.warning("Please enter your OpenAI API key.")
        
static_html.save()
