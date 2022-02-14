#include <iostream>

int rec(int a, int b) {
   if (a == 0) {
      return 1;
   }
   if (b == 0) {
      return 1 + rec(a - 1, 3);
   }

   return 1 + rec(a, b - 1);
}

int main() {
   std::cout << rec(3, 3);
}
