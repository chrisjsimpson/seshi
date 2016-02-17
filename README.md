Seshi is a web api which wrapps WebRTC & IndexedDB features from the html5 spec. It allows the ***decentralised storage of large files in the browser*** (IndexedDB), you can then ***send files direct to peers*** (WebRTC) and ***playback the files  within the browser*** (e.g. Video and audio).


#SeshiSkin

Seshi is modular by design (as much as we try!)

* Seshi skin is the font-end component to Seshi (this repo)
* It makes calls to the Seshi api. (repo: SeshiApi)
* The Seshi api in turn makes use of signaling servers (repo: SeshiSignal)