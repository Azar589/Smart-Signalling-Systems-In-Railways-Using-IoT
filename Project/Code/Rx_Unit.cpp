#include <RH_ASK.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>

RH_ASK rf_driver(2000, 16, -1, -1);
WiFiClient client;
HTTPClient http;

const long uploadInterval = 16000;           // 16s rate limit for ThingSpeak
unsigned long lastUploadTime = -uploadInterval; // Ensures first upload is never rate-limited
unsigned int lastSeqNum = 0;                  // Tracks the last received sequence

// Security Credentials
const char XOR_KEY = 0x5A; // Must match Tx unit
const String EXPECTED_ID = "TX1";

const String THINGSPEAK_API_KEY = "12WTGAIJQYNRUL22"; // ThingSpeak Write API Key

void encryptDecrypt(char* data, int len) {
  for(int i = 0; i < len; i++) {
    data[i] ^= XOR_KEY;
  }
}

void ConnectToWIFI() {
  WiFi.mode(WIFI_STA);
  WiFi.begin("Azar's M34", "azar@2005");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void thingSpeakWrite(String data) {
  // FIX 3: Check rate limit BEFORE receiving — log and skip clearly if throttled
  unsigned long now = millis();
  if (now - lastUploadTime < uploadInterval) {
    unsigned long remaining = uploadInterval - (now - lastUploadTime);
    Serial.println("Rate limited. Skipping upload. Retry in " + String(remaining / 1000) + "s. Data: " + data);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Attempting reconnect...");
    ConnectToWIFI();
  }

  String url = "http://api.thingspeak.com/update?api_key=" + THINGSPEAK_API_KEY + "&field1=" + data;
  http.begin(client, url);
  int httpcode = http.GET();

  // FIX 4: Properly validate the HTTP response code
  if (httpcode == 200) {
    String response = http.getString();
    if (response.toInt() > 0) {
      Serial.println("Cloud Sync Successful | Entry#: " + response + " | Data: " + data);
      lastUploadTime = millis(); // Only update timer on confirmed success
    } else {
      // ThingSpeak returns "0" when the update was rejected (e.g. same data, rate limit)
      Serial.println("Cloud Upload Rejected by ThingSpeak (returned 0). Data: " + data);
    }
  } else {
    Serial.println("Cloud Upload Failed! HTTP Code: " + String(httpcode) + " | Data: " + data);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  rf_driver.init();
  ConnectToWIFI();
}

void loop() {
  uint8_t buf[RH_ASK_MAX_MESSAGE_LEN + 1];
  uint8_t buflen = sizeof(buf) - 1;

  if (rf_driver.recv(buf, &buflen)) {
    buf[buflen] = '\0';

    // 1. Decrypt the incoming data
    encryptDecrypt((char*)buf, buflen);
    String payload = (char*)buf;

    // 2. Parse the payload (Looking for commas)
    int firstComma = payload.indexOf(',');
    int secondComma = payload.indexOf(',', firstComma + 1);

    if (firstComma > 0 && secondComma > 0) {
      String deviceID = payload.substring(0, firstComma);
      unsigned int recSeqNum = payload.substring(firstComma + 1, secondComma).toInt();
      String statusData = payload.substring(secondComma + 1);

      // 3. Authenticate Device ID and verify it's a new message (Anti-Replay)
      if (deviceID == EXPECTED_ID) {
        // FIX 2: Removed '|| lastSeqNum == 0' — it allowed replay attacks on boot.
        // lastSeqNum starts at 0 and TX starts at seqNum=1, so first valid packet will
        // always pass (1 > 0) without needing the bypass condition.
        if (recSeqNum > lastSeqNum) {
          Serial.println("Validated [Seq:" + String(recSeqNum) + "]: " + statusData);
          lastSeqNum = recSeqNum; // Save the new sequence number
          thingSpeakWrite(statusData); // Push to cloud
        } else {
          Serial.println("Blocked: Replay Attack Detected. Received Seq=" + String(recSeqNum) + " Last=" + String(lastSeqNum));
        }
      } else {
        Serial.println("Blocked: Unknown Device ID: " + deviceID);
      }
    } else {
      Serial.println("Blocked: Malformed or Corrupted Packet: " + payload);
    }
  }
}