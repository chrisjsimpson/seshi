# Seshi
Seshi allows peers to store files in the browser, play them back &amp; share them with a friend . 
It is a web based peer to peer file sending program which combines webrtc with indexeddb. It's written in Javascript. 

## Why Seshi.io
Seshi started out of an idea to create a truly decentralised file sharing tool which would put people back in 
control of their own content. I was frustrated by parts of the internet being branded a metaphorical highways 
for piracy and unimpressed by services being capable of creating peer to peer file sharing tools, but chosing 
to collect email addresses, and perform analytics on users data for re-marketing campaigns thus loosing sight 
of the potential for pure peer to peer technologies.

Seshi is quite a geeky peice of tehnology, but it is nothing new. It's simply how its architected which makes 
it different. Seshi dosn't need <http://seshi.io> in order to function, that is, the web server on which it runs is not 
required in order for people to connect to each other. You can, for example save the webpage locally and run 
it from there. Signalling is still needed of course (ie how do users find each other) and for this, finally a 
valid use case for QR codes is found. Seshi can generate QR codes containing your connection information which 
can be exchanged outside of the application (a so-called out of band communication). 

The codebase is (almost) split into two parts: Seshi Skin & Seshi Signal, making it easier for developers to build their own interface whilst still 
plugging into Seshi's storage and p2p framework*.

* Use it / play with it here: http://seshi.io
* The supporting paper for this project is in the root directory of this repository. (Seshi Paper - A vendor agnostic, browser based peer to peer file backup application developed using web standards.pdf) 


*Seshi is not a framework, its codebase is a work-in-progress and an insult to good coding practises. Feel free to help.
