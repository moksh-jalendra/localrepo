import cv2


capture = cv2.VideoCapture("testvid.mp4")


while True :
    

    isTrue , frame = capture.read()
    
    cv2.imshow('video ',frame)
    
    if cv2.waitKey(1) & 0xFF == ord('d'):
        break
     

capture.release()
cv2.destroyAllWindows()





# img =cv2.imread('Anya.jpg')

# cv2.imshow('hi',img)
# cv2.waitKey(0)


