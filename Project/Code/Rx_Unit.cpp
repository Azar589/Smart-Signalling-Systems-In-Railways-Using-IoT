#include <RH_ASK.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>

RH_ASK rf_driver(2000, 16, -1, -1);
WiFiClient client;
HTTPClient http;

unsigned long lastUploadTime = 0;
const long uploadInterval = 16000; // 16s rate limit for ThingSpeak
unsigned int lastSeqNum = 0; // Tracks the last received sequence

// Security Credentials
const char XOR_KEY = 0x5A; // Must match Tx unit
const String EXPECTED_ID = "TX1";

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
  if (millis() - lastUploadTime > uploadInterval) {
    String url = "http://api.thingspeak.com/update?api_key=12WTGAIJQYNRUL22&field1=" + data;
    http.begin(client, url);
    int httpcode = http.GET();
    
    if (httpcode > 0) {
      Serial.println("Cloud Sync Successful: " + data);
      lastUploadTime = millis();
    }
    http.end();
  }
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
        if (recSeqNum > lastSeqNum || lastSeqNum == 0) { 
          Serial.println("Validated: " + statusData);
          lastSeqNum = recSeqNum; // Save the new sequence number
          thingSpeakWrite(statusData); // Push to cloud
        } else {
          Serial.println("Blocked: Replay Attack Detected.");
        }
      } else {
        Serial.println("Blocked: Unknown Device ID.");
      }
    } else {
      Serial.println("Blocked: Malformed or Corrupted Packet.");
    }
  }
}