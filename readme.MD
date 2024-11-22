# About

Telegram bot that provides updated IRCC news through an RSS Feed. 

Welcome to the IRCC News Bot! 🤖🇨🇦

    Stay up-to-date with the latest Immigration, Refugees, and Citizenship Canada (IRCC) news and updates. 

    Here are some commands you can use:
    - /help - List down all the possible commands

    News: 
    - /latest_news - Get the latest news
    - /month [month] - Get news for a specific month (e.g., /month January)
    - /full - Get the full news feed

    Draws:
    - /last_draws - Get the last 5 IRCC draws
    - /draws [number] - Get the last [number] IRCC draws
    - /filter_draws [class] - Filter draws by class and shows the last 10 draws (e.g., /filter_draws CEC)
    
    Filter Draw codes: 
    "CEC" - Canadian Experience Class
    "FSW" - Federal Skilled Worker
    "FST" - Federal Skilled Trades
    "PNP  - Provincial Nomination Program


# Updates
**November 21, 2024**

- **Analyzer Enhancements**: Improved the analyzer to evaluate draws based on sufficient data points within each draw class.
- **Chart Display Logic**: Added logic to conditionally display charts only when there are enough data points.
- **Error Handling**: Revamped error handling mechanisms across the application for better reliability.


# Todo
## Logs
- [x] Add creation of local log files for metrics tracking (Daily log files in a log folder) -> Function is there, but can't log in heroku without using add-ons or something like AWS S3
  
## Draws
- [x] Consider changing from polling to webhook for lower server usage
- [x] Draw report
- [x] Filter draws by class
- [x] Specify occupations part of the draw
- [ ] Add link to the draw 
  
## Analyzer
- [ ] Evaluate the accuracy of the rolling average
## News
- [ ] Add press meeting news and other relevant news

## Chart
- [ ] Improve chart headline to include specific draw class
- [ ] Improve styling of chart (red primary color)


