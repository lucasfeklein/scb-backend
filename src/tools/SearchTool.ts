import { Tool } from './Tool';

class SearchTool extends Tool {
    constructor() {
        super(
            "Search",
            "search for information from the internet in real-time using Google Search.",
            "when the user asks something that you don't know or are not able to answer, but you think can be looked up from the internet, you will use this tool to find the answer and respond to the user. Always include the source URL if you respond with the information from the search result.",
            "text input containing the query, input must be strictly one line. Make sure to use a search query that most likely returns relevant results from Google Search.",
            "the query result from the internet containing title, snippet, and URL."
        );
    }
}


export const searchTool = new SearchTool();