import { useState } from "react";

const App = () => {
    const [ image, setImage ] = useState(null)
    const [ value, setValue ] = useState("")
    const [ response, setResponse ] = useState("")
    const [ error, setError ] = useState("")

    /* const surpriseOptions = [ // random incorporate in 2 function later --> POSSIBLE FEATURE IN FUTURE
      'Is this item in good condition?',
      'Is this item pink?',
      'What brand can you identify in this image?'
    ]

    const surprise = () => {
      const randomValue = surpriseOptions[Math.floor(Math.random() * surpriseOptions.length)]
      setValue(randomValue)
    } */

    const uploadImage = async (e) => {
      const formData = new FormData()
      formData.append('file', e.target.files[0])
      setImage(e.target.files[0])
      e.target.value = null
      try{
        const options = {
          method: 'POST',
          body: formData
        }
        const response = await fetch ('http://localhost:8000/upload', options)
        const data = response.json()
        console.log(data)
      } catch (err) {
        console.log(err)
        setError("Something didn't work! Please try again.")
      }
    }

    // testing -> console.log(value)

    const priceEstimate = async() => { // apply function
      setResponse("")
      if (!image){
        setError("Error, no image attached.")
        return
      }
      try { // API POST
        const options = {
          method: "POST",
          body: JSON.stringify({
            message: value
          }),
          headers: {
            "Content-Type": "application/json"
          }
        }
        const response = await fetch("http://localhost:8000/openai1", options) // HTTPS??!?!?!?
        const text = await response.text()
        setResponse(text)
        
      } catch (err) {
        console.log(err)
        setError("Something didn't work! Please try again.")
      }
    }

    const clear = () => { // resetting allat
      setImage(null)
      setValue("")
      setResponse("")
      setError("")
    }

    return (
        <div className="app">
          <section className="search-section">
            <div className="image-container">
                {image && <img src={URL.createObjectURL(image)}/>}
            </div>
            <p className="extra-info">
              <span>
                <label htmlFor="files"> upload an image </label>
                <input onChange={uploadImage} id="files" accept="image/*" type="file"/> <br></br>
              </span>
              to ask questions about
            </p>
            <button className="estimate" onClick={priceEstimate}>Click this button for a price estimate</button>
            <div className="input-container">
              <input
                value={value}
                placeholder="extra information" // fix this
                onChange={e => setValue(e.target.value)}
              />
              {(response || error) && <button onClick={clear}>Clear</button>}
            </div>
            {error && <p>{error}</p>}
            {response && <p className="answer">{response}</p>}
          </section>
        </div>

  )
}

export default App
