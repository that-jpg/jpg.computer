#include <iostream>
#include <stdlib.h>
using namespace std;


int main() {
	int n;
	cin >> n;
	bool state = false;
	while(n--) {
		int s, d;
		cin >> s >> d;
		int possible = s / 2;
		for (int i = possible + 1; i < s; i++) {
			if (abs(i - (possible - i)) == d) {
				cout << i << " " << (possible - i) << endl; 
				state = true;
				break;
			} 
		}
		if (!state) {
			cout << "impossible" << endl;
			state = false;
		}
	}
}
