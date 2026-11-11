# Home Intercom PTT / Home Intercom Lovelace

[Русский](README.md) | [English](README.en.md)

[![GitHub stars](https://img.shields.io/github/stars/alshevskij/home-intercom-lovelace?style=flat-square)](https://github.com/alshevskij/home-intercom-lovelace/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/alshevskij/home-intercom-lovelace?style=flat-square)](https://github.com/alshevskij/home-intercom-lovelace/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/alshevskij/home-intercom-lovelace?style=flat-square)](https://github.com/alshevskij/home-intercom-lovelace/issues)

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=alshevskij&repository=home-intercom-lovelace&category=plugin">
    <img src="https://img.shields.io/badge/Добавить%20в-Home%20Assistant-03A9F4?style=for-the-badge&logo=homeassistant&logoColor=white" alt="Добавить в Home Assistant">
  </a>
</p>

Логическое продолжение пользовательской интеграции [Home Intercom](https://github.com/mdj2812/home-intercom), которая позволяет превратить медиаплееры Home Assistant в своеобразные стационарные домашние телефоны-рации.

Home Intercom PTT — это Lovelace-карточка, предназначенная для удобной голосовой связи между устройствами. Она дополняет стандартный интерфейс основной интеграции (который представлен отдельной веб-страницей, что мне показалось не совсем удобным), позволяя управлять домашней связью непосредственно с дашборда Home Assistant.

Карточка устанавливается отдельно от основной интеграции и может быть добавлена на любой дашборд.

## Возможности

- Push-to-Talk: удерживайте кнопку для записи голосового сообщения и отпустите для его отправки.
- Отправка сообщений в отдельную комнату или сразу во все комнаты.
- Отображение доступности устройств и комнат.
- Визуальный редактор конфигурации.
- Гибкая настройка внешнего вида: цвета, размеры, подписи, иконки и расположение элементов.
- Стеклянное оформление, подсветка и анимация во время записи.

## Требования

- Home Assistant.
- Установленная и настроенная интеграция [Home Intercom](https://github.com/mdj2812/home-intercom), предоставляющая необходимый Backend API (`/api/home_intercom`).

## YAML

Минимальная конфигурация карточки:

```yaml
type: custom:home-intercom-ptt-card
```

Остальные параметры и настройки внешнего вида доступны через визуальный редактор карточки.

## Внешний вид карточки

<img width="539" height="571" alt="visual" src="https://github.com/user-attachments/assets/6fdf5a4a-548f-423b-8218-69fc698ca37c" />

## Совместимость

Home Intercom PTT является самостоятельным frontend-дополнением для Home Assistant. Карточка не заменяет и не изменяет основную интеграцию [Home Intercom](https://github.com/mdj2812/home-intercom), а использует предоставляемый ею Backend API для взаимодействия с устройствами.
