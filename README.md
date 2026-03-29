Here is a comprehensive and professionally structured README file for your project, incorporating all the provided details and code logic.

***

# Smart Signalling Systems in Railways

**Author**: Mohamed Azarudeen F.

## 📖 Abstract
The Smart Signalling System for Railways addresses critical visibility challenges faced by locomotive pilots, especially during adverse weather conditions such as fog and rain. The project introduces an advanced signalling solution using RF transceiver technology to ensure reliable, real-time communication between trackside signals and locomotives. 

By integrating RF transceivers with microcontrollers (ESP32 and Arduino Nano), trackside signal data is transmitted directly to a display monitor inside the train, entirely eliminating the dependency on visual cues. This system significantly enhances safety, reduces travel delays, and minimizes human error. Built with a focus on scalability, cost-effectiveness, and future IoT integration, it aligns with multiple UN Sustainable Development Goals by emphasizing innovation, safety, and infrastructure development.

## ✨ Key Features
* **Real-Time RF Communication**: Sends trackside status updates (RED, YELLOW, GREEN) to the locomotive instantaneously upon status change.
* **Robust Security Protocols**: Implements an XOR cipher with a predefined secret key (`0x5A`) for encrypting payload data.
* **Anti-Replay Attack Protection**: Utilizes incrementing sequence numbers to validate incoming packets and reject malicious replay attempts.
* **Device Authentication**: Enforces strict verification using a unique Device ID (`TX1`) to ensure the receiver only processes data from authorized trackside transmitters.
* **IoT Cloud Integration**: Securely uploads validated signal data to the ThingSpeak cloud platform over WiFi, utilizing a 16-second rate limit to comply with API constraints.
* **Local Web Dashboard**: Includes a custom Node.js server to host a real-time web monitoring dashboard (`Signal_Monitor_Web.html`) over port 8080.

## 🛠️ Hardware Requirements
* **Microcontrollers**: ESP32 (for the Receiver/Locomotive unit with WiFi capabilities) and Arduino Nano (for the Transmitter/Trackside unit).
* **Communication**: RF Transceiver modules compatible with the `RH_ASK` library.
* **Sensors/Indicators**: Trackside signal switches/sensors and corresponding LEDs for local status visualization.

## 💻 System Architecture

### 1. Transmitter Unit (`Tx_Unit.cpp`)
Located at the trackside, this unit reads digital inputs representing the current signal status (RED, YELLOW, GREEN). It monitors for state changes to reduce unnecessary RF traffic. When a change is detected, it formats a comma-separated payload containing the Device ID, an incrementing Sequence Number, and the Signal Status. The payload is then encrypted via XOR cipher and broadcasted over RF.

### 2. Receiver Unit (`Rx_Unit.cpp`)
Located inside the locomotive, this unit continuously listens for RF transmissions. Upon receiving a packet, it decrypts the string and extracts the comma-separated values. The unit verifies the `DEVICE_ID` and ensures the sequence number is strictly greater than the previously recorded sequence to prevent replay attacks. If valid, the new status is printed to the serial monitor and uploaded to a ThingSpeak channel via an HTTP GET request.

### 3. Web Dashboard Server (`server.js`)
A lightweight Node.js web server that serves the UI files (`.html`, `.css`, `.js`). Once started, it listens on port 8080 and provides a centralized interface for monitoring the IoT data sent by the trains. 

## 🚀 Installation and Setup

### Embedded Code Setup (Arduino IDE)
1.  **Dependencies**: Install the required C++ libraries via the Arduino Library Manager:
    * `RH_ASK` (RadioHead library for RF communication)
    * `WiFi` and `HTTPClient` (For ESP32 IoT connectivity)
2.  **Configuration**: 
    * In `Rx_Unit.cpp`, update the WiFi credentials (`WiFi.begin("SSID", "PASSWORD");`) to match your network.
    * Ensure your ThingSpeak API key is correctly set in the `thingSpeakWrite()` function URL.
3.  **Flashing**: Upload `Tx_Unit.cpp` to the Arduino Nano and `Rx_Unit.cpp` to the ESP32 using a baud rate of `115200`.

### Web Server Setup
1.  Navigate to the `Website` directory containing `server.js`.
2.  Ensure Node.js is installed on your machine.
3.  Run the server from the terminal:
    ```bash
    node server.js
    ```
4.  Open a browser and navigate to `http://localhost:8080` to access the dashboard.
