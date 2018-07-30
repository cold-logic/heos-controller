# Heos Controller
Desktop controller for [Denon Heos](http://heosbydenon.denon.com) wifi speakers.

## Screenshot

![](screenshot.png)

## Features
* Automatic detection of speakers
* User friendly volume dial
* Playback controls (previous, play/pause, next)

## Usage
1. [Download a release](https://github.com/cold-logic/heos-controller/releases) and extract the app into your Applications directory
2. Run the app and wait for speaker detection
3. Select a speaker from the dropdown and use the controls

## Development
1. Clone this repo
2. Install all the node and bower packages using the `npm run setup` command
3. Run the app using `npm start` or `gulp`
4. To preview changes made in the *app* directory while the app is running, refresh with the (cmd-r) hot key
5. Dev tools are available using the (cmd-opt-i) hot key

## ToDo
* Detection and control of grouped speakers
* Details about the currently playing stream
* A slider to scrub and track playback position
* A "sources" media stream picker
