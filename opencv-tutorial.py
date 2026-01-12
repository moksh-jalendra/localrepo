import cv2
import os

cap= cv2.VideoCapture("testvid.mp4")
os.makedirs("frame" , exist_ok=True)
count=0
n=50
# ret,frame = cap.read()
# print(ret)
# print(type(frame))
# print(frame.shape)
# print(cv2.__version__)

# while True :
#     ret,frame = cap.read()

#     if not ret :
#         print('video endead ')
#         break

#     print(type(frame),ret ,frame.shape)

# cap.release()

while True :
    ret , frame = cap.read()
    if not ret :
        break
    if count % n == 0 :
        cv2.imwrite(f"frame/frame {count}.jpg",frame)

    count=count+1

cap.release()
