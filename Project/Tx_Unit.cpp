#include <RH_ASK.h>
#include <SPI.h>

RH_ASK rf_driver(2000, -1, 4, -1);

const int red_l=0, yellow_l=2, green_l=14;
const int red_s=5, yellow_s=12, green_s=13;

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
  rf_driver.init();
  
  pinMode(red_l, OUTPUT); pinMode(yellow_l, OUTPUT); pinMode(green_l, OUTPUT);
  pinMode(red_s, INPUT); pinMode(yellow_s, INPUT); pinMode(green_s, INPUT);
}

void loop() {
  String currentStatus = "";

  if(digitalRead(red_s) == HIGH) {
    digitalWrite(red_l, HIGH);
    currentStatus = "RED";
  } else digitalWrite(red_l, LOW);

  if(digitalRead(yellow_s) == HIGH) {
    digitalWrite(yellow_l, HIGH);
    currentStatus = "YELLOW";
  } else digitalWrite(yellow_l, LOW);

  if(digitalRead(green_s) == HIGH) {
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
  delay(50);
}