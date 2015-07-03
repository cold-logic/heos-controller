# Heos Controller
Desktop controller for [Denon Heos](http://heosbydenon.denon.com) wifi speakers.

## Screenshot

![](screenshot.png)

## Features
* Automatic detection of speakers
* User friendly volume dial
* Playback controls (previous, play/pause, next)

## Usage
0. Install all the node and bower packages using the `npm run setup` command.
0. Build the app using the `gulp build` command.
0. The built app can be found in the *build* directory.

## Development
0. A debug version of the app can be tested using the default gulp task by running `gulp`
0. Any changes made in the *app* directory can be pulled in by refreshing with the (cmd-r) hot key.
0. Dev tools are available using the (cmd-opt-i) hot key.

## ToDo
* Detection and control of grouped speakers
* Details about the currently playing stream
* A slider to scrub and track playback position
* A "sources" media stream picker