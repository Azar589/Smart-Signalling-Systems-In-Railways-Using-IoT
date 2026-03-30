#include <RH_ASK.h>
#include <SPI.h>

// RF Data on D5 (GPIO 14) - Avoiding SPI and Boot conflicts
RH_ASK rf_driver(2000, -1, 14, -1);

// LED Pins (Outputs)
const int red_l = 5;     // D1
const int yellow_l = 4;  // D2
const int green_l = 16;  // D0

// Signal Input Pins (Switches) - Using INPUT_PULLUP (Switch to GND)
const int red_s = 0;     // D3 (GPIO 0)
const int yellow_s = 2;  // D4 (GPIO 2)
const int green_s = 3;   // RX (GPIO 3) - Safe as input after setup

String lastStatus = "";
unsigned int seqNum = 0; // Sequence counter to prevent replay attacks

// Security Credentials
const char XOR_KEY = 0x5A; // Secret key for encryption (must match Rx)
const String DEVICE_ID = "TX1"; // Unique identifier for this transmitter

// Simple lightweight XOR cipher
void encryptDecrypt(char* data, int len) {
  for(int i = 0; i < len; i++) {
    data[i] ^= XOR_KEY;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500); 
  
  if (!rf_driver.init()) {
    Serial.println("RF Driver initialization failed!");
  }
  
  pinMode(red_l, OUTPUT); pinMode(yellow_l, OUTPUT); pinMode(green_l, OUTPUT);
  
  // Using Internal Pullups: Switches must connect to Ground (GND)
  pinMode(red_s, INPUT_PULLUP); 
  pinMode(yellow_s, INPUT_PULLUP); 
  pinMode(green_s, INPUT_PULLUP); 
  
  Serial.println("ESP8266 Tx Unit initialized (Pins 12, 13, 15 avoided).");
}

void loop() {
  String currentStatus = "";

  // Logic: LOW means the switch is pressed (connected to GND)
  if(digitalRead(red_s) == LOW) {
    digitalWrite(red_l, HIGH);
    currentStatus = "RED";
  } else digitalWrite(red_l, LOW);

  if(digitalRead(yellow_s) == LOW) {
    digitalWrite(yellow_l, HIGH);
    currentStatus = "YELLOW";
  } else digitalWrite(yellow_l, LOW);

  if(digitalRead(green_s) == LOW) {
    digitalWrite(green_l, HIGH);
    currentStatus = "GREEN";
  } else digitalWrite(green_l, LOW);

  // Only send if status changes
  if (currentStatus != "" && currentStatus != lastStatus) {
    seqNum++; // Increment sequence for every new transmission
    
    // Construct Payload: "TX1,1,RED"
    String payload = DEVICE_ID + "," + String(seqNum) + "," + currentStatus;
    
    int len = payload.length();
    char msgBuffer[len + 1];
    payload.toCharArray(msgBuffer, len + 1);
    
    encryptDecrypt(msgBuffer, len); // Encrypt before sending
    
    rf_driver.send((uint8_t *)msgBuffer, len);
    rf_driver.waitPacketSent();
    
    Serial.println("Sent Securely: " + payload);
    lastStatus = currentStatus;
  }
  
  yield(); // Allow ESP8266 to handle background tasks
  delay(50);
}

