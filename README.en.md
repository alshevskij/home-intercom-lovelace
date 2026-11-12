# Home Intercom PTT / Home Intercom Lovelace

[Русский](README.md) | [English](README.en.md)

[![GitHub stars](https://img.shields.io/github/stars/alshevskij/home-intercom-lovelace?style=flat-square)](https://github.com/alshevskij/home-intercom-lovelace/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/alshevskij/home-intercom-lovelace?style=flat-square)](https://github.com/alshevskij/home-intercom-lovelace/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/alshevskij/home-intercom-lovelace?style=flat-square)](https://github.com/alshevskij/home-intercom-lovelace/issues)

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=alshevskij&repository=home-intercom-lovelace&category=plugin">
    <img src="https://img.shields.io/badge/Add%20to-Home%20Assistant-03A9F4?style=for-the-badge&logo=homeassistant&logoColor=white" alt="Add to Home Assistant">
  </a>
</p>

A companion to the [Home Intercom](https://github.com/mdj2812/home-intercom) custom integration, which turns Home Assistant media players into dedicated home intercom devices — essentially stationary home phones with walkie-talkie functionality.

Home Intercom PTT is a Lovelace card designed to make voice communication between devices easy. It complements the standard interface of the main integration (which is provided as a separate web page that I personally found less convenient), allowing you to manage home communication directly from your Home Assistant dashboard.

The card is installed separately from the main integration and can be added to any dashboard.

## Features

- Push-to-Talk: hold the button to record a voice message and release it to send.
- Lock a recording by swiping left: stop it with a separate button, preview it, then send or cancel.
- Custom device groups with configurable membership, icon, name, and default collapsed state.
- An optional group-wide record/send button that can be hidden globally or per group.
- Send messages to an individual room or to all rooms at once.
- Display the availability of devices and rooms.
- Visual configuration editor.
- Flexible appearance settings.
- Glass-style design, glow effects, and recording animation.

## Requirements

- Home Assistant.
- The [Home Intercom](https://github.com/mdj2812/home-intercom) integration installed and configured, providing the required Backend API (`/api/home_intercom`).

## YAML

Minimal card configuration:

```yaml
type: custom:home-intercom-ptt-card
```

All other parameters and appearance settings are available through the card's visual editor.

## Card appearance

<img width="539" height="571" alt="visual" src="https://github.com/user-attachments/assets/6fdf5a4a-548f-423b-8218-69fc698ca37c" />

## Compatibility

Home Intercom PTT is a standalone frontend add-on for Home Assistant. The card does not replace or modify the [Home Intercom](https://github.com/mdj2812/home-intercom) integration. It uses the Backend API provided by that integration to communicate with devices.
