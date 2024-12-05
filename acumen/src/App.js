import { useState } from "react";

const App = () => {
    const [ image, setImage ] = useState(null)
    const [ value, setValue ] = useState("")
    const [ response, setResponse ] = useState("")
    const [ error, setError ] = useState("")
    const [ currency, setCurrency ] = useState("AUD")
    const [ condition, setCondition ] = useState("Good")
    const [ platforms, setPlatforms ] = useState([])

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
            currency,
            condition,
            platforms,
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

    const handlePlatformChange = (e) => {
      const { value, checked } = e.target;
      setPlatforms(prev =>
        checked ? [...prev, value] : prev.filter(platform => platform !== value)
      );
    };

    const clear = () => { // resetting allat
      setImage(null)
      setValue("")
      setResponse("")
      setError("")
      setCurrency("AUD")
      setCondition("Good")
      setPlatforms([])
      setImage(null)
      setValue("")
      setResponse("")
      setError("")
    }

    return (
        <div className="app">
          <h1 className="app-title">Acumen</h1>
          <section className="search-section">
            <div className="dropdown-container">
              <label htmlFor="currency">What currency do you wish to sell your item in?</label>
              <select id="currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="AUD">AUD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
            <div className="dropdown-container">
              <label htmlFor="condition">What is the condition of your item?</label>
              <select id="condition" value={condition} onChange={e => setCondition(e.target.value)}>
                <option value="For Parts">For Parts</option>
                <option value="Refurbished">Refurbished</option>
                <option value="Acceptable">Acceptable</option>
                <option value="Good">Good</option>
                <option value="Very Good">Very Good</option>
                <option value="Like New">Like New</option>
                <option value="Brand New">Brand New</option>
              </select>
            </div>
            <div className="checkbox-container">
              <p>Select the platforms you wish to use:</p>
              <label>
                <input type="checkbox" value="Facebook Marketplace" onChange={handlePlatformChange} />
                Facebook Marketplace
              </label>
              <label>
                <input type="checkbox" value="Depop" onChange={handlePlatformChange} />
                Depop
              </label>
              <label>
                <input type="checkbox" value="Gumtree" onChange={handlePlatformChange} />
                Gumtree
              </label>
              <label>
                <input type="checkbox" value="StockX" onChange={handlePlatformChange} />
                StockX
              </label>
            </div>
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
            {response && <div className="answer" dangerouslySetInnerHTML={{ __html: response }} />}
          </section>
        </div>

  )
}

export default App
